import { randomBytes } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { WorkspaceRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from '../auth/auth.guard.js';
import { AuditService } from './audit.service.js';

const slugify = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'workspace';

const newSlug = (name: string) => `${slugify(name)}-${randomBytes(3).toString('hex')}`;

type Actor = Pick<AuthUser, 'id' | 'email'>;

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Workspace milik pengguna beserta perannya. */
  async listMine(userId: string) {
    const rows = await this.prisma.membership.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { role: true, workspace: { select: { id: true, name: true, slug: true } } },
    });
    return rows.map((r) => ({ ...r.workspace, role: r.role }));
  }

  async create(actor: Actor, name: string) {
    const ws = await this.prisma.workspace.create({
      data: {
        name: name.trim(),
        slug: newSlug(name),
        memberships: { create: { userId: actor.id, role: 'OWNER' } },
      },
      select: { id: true, name: true, slug: true },
    });
    await this.audit.log({
      workspaceId: ws.id,
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'workspace.created',
      detail: ws.name,
    });
    return { ...ws, role: 'OWNER' as const };
  }

  async rename(actor: Actor, workspaceId: string, name: string) {
    const ws = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: name.trim() },
      select: { id: true, name: true, slug: true },
    });
    await this.audit.log({ workspaceId, actorId: actor.id, actorEmail: actor.email, action: 'workspace.renamed', detail: ws.name });
    return ws;
  }

  async remove(workspaceId: string) {
    await this.prisma.workspace.delete({ where: { id: workspaceId } });
  }

  async members(workspaceId: string) {
    const [members, invites] = await Promise.all([
      this.prisma.membership.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'asc' },
        select: { role: true, createdAt: true, user: { select: { id: true, email: true, name: true, image: true } } },
      }),
      this.prisma.invite.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, email: true, role: true, createdAt: true },
      }),
    ]);
    return {
      members: members.map((m) => ({ ...m.user, role: m.role, joinedAt: m.createdAt })),
      invites,
    };
  }

  /** Admin hanya boleh mengelola ADMIN/MEMBER; hanya OWNER yang boleh menyentuh peran OWNER. */
  private assertCanGrant(actorRole: WorkspaceRole, target: WorkspaceRole) {
    if (target === 'OWNER' && actorRole !== 'OWNER') throw new ForbiddenException('Hanya pemilik yang boleh mengatur peran pemilik');
  }

  async addMember(actor: Actor, actorRole: WorkspaceRole, workspaceId: string, rawEmail: string, role: WorkspaceRole) {
    this.assertCanGrant(actorRole, role);
    const email = rawEmail.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      const exists = await this.prisma.membership.findUnique({
        where: { userId_workspaceId: { userId: user.id, workspaceId } },
        select: { id: true },
      });
      if (exists) throw new ConflictException('Pengguna ini sudah menjadi anggota');
      await this.prisma.membership.create({ data: { userId: user.id, workspaceId, role } });
      await this.audit.log({ workspaceId, actorId: actor.id, actorEmail: actor.email, action: 'member.added', target: email, detail: role });
      return { status: 'added' as const };
    }
    await this.prisma.invite.upsert({
      where: { workspaceId_email: { workspaceId, email } },
      create: { workspaceId, email, role, invitedById: actor.id },
      update: { role, invitedById: actor.id },
    });
    await this.audit.log({ workspaceId, actorId: actor.id, actorEmail: actor.email, action: 'member.invited', target: email, detail: role });
    return { status: 'invited' as const };
  }

  private async ownerCount(workspaceId: string) {
    return this.prisma.membership.count({ where: { workspaceId, role: 'OWNER' } });
  }

  async changeRole(actor: Actor, actorRole: WorkspaceRole, workspaceId: string, userId: string, role: WorkspaceRole) {
    const target = await this.prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { role: true, user: { select: { email: true } } },
    });
    if (!target) throw new NotFoundException('Anggota tidak ditemukan');
    this.assertCanGrant(actorRole, role);
    this.assertCanGrant(actorRole, target.role);
    if (target.role === 'OWNER' && role !== 'OWNER' && (await this.ownerCount(workspaceId)) <= 1) {
      throw new BadRequestException('Workspace harus punya minimal satu pemilik');
    }
    await this.prisma.membership.update({ where: { userId_workspaceId: { userId, workspaceId } }, data: { role } });
    await this.audit.log({
      workspaceId,
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'member.role_changed',
      target: target.user.email,
      detail: `${target.role} → ${role}`,
    });
  }

  /** Anggota boleh keluar sendiri; admin/pemilik boleh mengeluarkan anggota sesuai aturan peran. */
  async removeMember(actor: Actor, actorRole: WorkspaceRole, workspaceId: string, userId: string) {
    const target = await this.prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { role: true, user: { select: { email: true } } },
    });
    if (!target) throw new NotFoundException('Anggota tidak ditemukan');
    const self = userId === actor.id;
    if (!self) {
      if (actorRole === 'MEMBER') throw new ForbiddenException('Peran Anda tidak boleh mengeluarkan anggota');
      this.assertCanGrant(actorRole, target.role);
    }
    if (target.role === 'OWNER' && (await this.ownerCount(workspaceId)) <= 1) {
      throw new BadRequestException('Pemilik terakhir tidak bisa dikeluarkan. Alihkan kepemilikan atau hapus workspace.');
    }
    await this.prisma.membership.delete({ where: { userId_workspaceId: { userId, workspaceId } } });
    await this.audit.log({
      workspaceId,
      actorId: actor.id,
      actorEmail: actor.email,
      action: self ? 'member.left' : 'member.removed',
      target: target.user.email,
    });
  }

  async revokeInvite(actor: Actor, workspaceId: string, inviteId: string) {
    const invite = await this.prisma.invite.findFirst({ where: { id: inviteId, workspaceId }, select: { email: true } });
    if (!invite) throw new NotFoundException('Undangan tidak ditemukan');
    await this.prisma.invite.delete({ where: { id: inviteId } });
    await this.audit.log({ workspaceId, actorId: actor.id, actorEmail: actor.email, action: 'invite.revoked', target: invite.email });
  }

  /**
   * Dipanggil saat akun dibuat atau masuk: klaim undangan yang menunggu email ini; bila akun belum punya
   * workspace sama sekali, buatkan satu workspace pribadi agar selalu ada tempat bekerja.
   */
  async provisionFor(user: { id: string; email: string; name: string | null }) {
    const invites = await this.prisma.invite.findMany({ where: { email: user.email.toLowerCase() } });
    for (const inv of invites) {
      await this.prisma.$transaction([
        this.prisma.membership.upsert({
          where: { userId_workspaceId: { userId: user.id, workspaceId: inv.workspaceId } },
          create: { userId: user.id, workspaceId: inv.workspaceId, role: inv.role },
          update: {},
        }),
        this.prisma.invite.delete({ where: { id: inv.id } }),
      ]);
      await this.audit.log({
        workspaceId: inv.workspaceId,
        actorId: user.id,
        actorEmail: user.email,
        action: 'member.joined',
        target: user.email,
        detail: inv.role,
      });
    }
    const count = await this.prisma.membership.count({ where: { userId: user.id } });
    if (count === 0) {
      await this.create({ id: user.id, email: user.email }, `${user.name?.trim() || user.email.split('@')[0]} (Pribadi)`);
    }
  }
}
