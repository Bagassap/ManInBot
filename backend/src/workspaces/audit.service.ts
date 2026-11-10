import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AuditEntry {
  workspaceId: string;
  actorId: string | null;
  actorEmail: string;
  action: string;
  target?: string | null;
  detail?: string | null;
}

/** Catatan audit per workspace. Kegagalan mencatat tidak boleh menggagalkan tindakan aslinya. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(e: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          workspaceId: e.workspaceId,
          actorId: e.actorId,
          actorEmail: e.actorEmail,
          action: e.action,
          target: e.target?.slice(0, 200) ?? null,
          detail: e.detail?.slice(0, 500) ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`Gagal mencatat audit: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async list(workspaceId: string, opts: { before?: string; take?: number; action?: string }) {
    const take = Math.min(Math.max(opts.take ?? 50, 1), 200);
    const before = opts.before ? new Date(opts.before) : null;
    const rows = await this.prisma.auditLog.findMany({
      where: {
        workspaceId,
        ...(opts.action ? { action: { startsWith: opts.action } } : {}),
        ...(before && !Number.isNaN(before.getTime()) ? { createdAt: { lt: before } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
    });
    const more = rows.length > take;
    return { items: rows.slice(0, take), next: more ? rows[take - 1].createdAt.toISOString() : null };
  }
}
