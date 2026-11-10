import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { AuthUser } from '../auth/auth.guard.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateUserDto, ResetPasswordDto, RunsQueryDto, UpdateUserDto } from './admin.dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const TZ = 'Asia/Jakarta';

/** Tanggal (YYYY-MM-DD) pada zona waktu Jakarta. */
const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);

export const delta = (now: number, prev: number) => (prev === 0 ? (now === 0 ? 0 : null) : ((now - prev) / prev) * 100);

/** Mengelompokkan run per hari (zona waktu TZ) di aplikasi, agar tidak bergantung pada SQL khusus satu database. */
function bucketByDay(rows: { createdAt: Date; status: string; durationMs: number }[]): DayRow[] {
  const days = new Map<string, { runs: number; errors: number; ms: number }>();
  for (const r of rows) {
    const key = dayKey(r.createdAt);
    const d = days.get(key) ?? { runs: 0, errors: 0, ms: 0 };
    d.runs++;
    if (r.status === 'ERROR') d.errors++;
    d.ms += r.durationMs;
    days.set(key, d);
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, d]) => ({ day, runs: d.runs, errors: d.errors, avgms: d.runs ? d.ms / d.runs : 0 }));
}

interface DayRow {
  day: string;
  runs: number;
  errors: number;
  avgms: number;
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private windows(days = 30) {
    const now = new Date();
    const from = new Date(now.getTime() - days * DAY_MS);
    const prevFrom = new Date(from.getTime() - days * DAY_MS);
    return { days, now, from, prevFrom };
  }

  async overview(daysParam?: number) {
    const { days, now, from, prevFrom } = this.windows(daysParam);
    const inCur = { createdAt: { gte: from } };
    const inPrev = { createdAt: { gte: prevFrom, lt: from } };

    const [cur, prev, errCur, errPrev, models, perDay, usersTotal, usersNew, activeUsers, conversations] = await Promise.all([
      this.prisma.agentRun.aggregate({
        where: inCur,
        _count: true,
        _avg: { durationMs: true },
        _sum: { inputTokens: true, outputTokens: true, toolCalls: true },
      }),
      this.prisma.agentRun.aggregate({
        where: inPrev,
        _count: true,
        _avg: { durationMs: true },
        _sum: { inputTokens: true, outputTokens: true },
      }),
      this.prisma.agentRun.count({ where: { ...inCur, status: 'ERROR' } }),
      this.prisma.agentRun.count({ where: { ...inPrev, status: 'ERROR' } }),
      this.prisma.agentRun.groupBy({
        by: ['model'],
        where: inCur,
        _count: true,
        _sum: { inputTokens: true, outputTokens: true },
        orderBy: { _count: { model: 'desc' } },
        take: 3,
      }),
      this.prisma.agentRun
        .findMany({ where: { createdAt: { gte: from } }, select: { createdAt: true, status: true, durationMs: true } })
        .then(bucketByDay),
      this.prisma.user.count(),
      this.prisma.user.count({ where: inCur }),
      this.prisma.agentRun.groupBy({ by: ['userId'], where: inCur }).then((r) => r.length),
      this.prisma.conversation.count(),
    ]);

    // Isi hari tanpa data dengan nol agar grafik tidak bolong.
    const byDay = new Map(perDay.map((r) => [r.day, r]));
    const series: { date: string; runs: number; errors: number; avgLatencyMs: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const key = dayKey(new Date(now.getTime() - i * DAY_MS));
      const r = byDay.get(key);
      series.push({ date: key, runs: r?.runs ?? 0, errors: r?.errors ?? 0, avgLatencyMs: Math.round(r?.avgms ?? 0) });
    }

    const runs = cur._count;
    const tokens = (cur._sum.inputTokens ?? 0) + (cur._sum.outputTokens ?? 0);
    const prevTokens = (prev._sum.inputTokens ?? 0) + (prev._sum.outputTokens ?? 0);
    const avg = Math.round(cur._avg.durationMs ?? 0);
    const prevAvg = Math.round(prev._avg.durationMs ?? 0);

    return {
      days,
      kpis: {
        runs: { value: runs, delta: delta(runs, prev._count) },
        errors: { value: errCur, rate: runs ? (errCur / runs) * 100 : 0, delta: delta(errCur, errPrev) },
        latency: { avgMs: avg, delta: delta(avg, prevAvg) },
        tokens: {
          total: tokens,
          input: cur._sum.inputTokens ?? 0,
          output: cur._sum.outputTokens ?? 0,
          toolCalls: cur._sum.toolCalls ?? 0,
          delta: delta(tokens, prevTokens),
        },
        users: { total: usersTotal, new: usersNew, active: activeUsers },
        conversations,
      },
      series,
      models: models.map((m) => ({
        model: m.model,
        runs: m._count,
        inputTokens: m._sum.inputTokens ?? 0,
        outputTokens: m._sum.outputTokens ?? 0,
      })),
    };
  }

  private runWhere(q: RunsQueryDto, withStatus: boolean): Prisma.AgentRunWhereInput {
    const { from } = this.windows(q.days);
    const search = q.q?.trim();
    return {
      createdAt: { gte: from },
      ...(withStatus && q.status ? { status: q.status } : {}),
      ...(q.userId ? { userId: q.userId } : {}),
      ...(search
        ? {
            OR: [
              { prompt: { contains: search } },
              { user: { email: { contains: search } } },
              { user: { name: { contains: search } } },
            ],
          }
        : {}),
    };
  }

  async runs(q: RunsQueryDto) {
    const [rows, grouped] = await Promise.all([
      this.prisma.agentRun.findMany({
        where: this.runWhere(q, true),
        orderBy: { createdAt: 'desc' },
        take: q.take ?? 50,
        select: {
          id: true,
          createdAt: true,
          status: true,
          durationMs: true,
          inputTokens: true,
          outputTokens: true,
          toolCalls: true,
          model: true,
          prompt: true,
          conversationId: true,
          user: { select: { id: true, email: true, name: true } },
        },
      }),
      this.prisma.agentRun.groupBy({ by: ['status'], where: this.runWhere(q, false), _count: true }),
    ]);
    const counts = { ALL: 0, SUCCESS: 0, ERROR: 0, ABORTED: 0 };
    for (const g of grouped) {
      counts[g.status] = g._count;
      counts.ALL += g._count;
    }
    return { counts, items: rows };
  }

  async runDetail(id: string) {
    const run = await this.prisma.agentRun.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true, name: true, image: true } } },
    });
    if (!run) throw new NotFoundException('Run tidak ditemukan');
    const messages = run.conversationId
      ? await this.prisma.message.findMany({
          where: { conversationId: run.conversationId, createdAt: { lte: new Date(run.createdAt.getTime() + 60_000) } },
          orderBy: { createdAt: 'desc' },
          take: 6,
          select: { id: true, role: true, content: true, steps: true, createdAt: true },
        })
      : [];
    return { run, messages: messages.reverse() };
  }

  async users(daysParam?: number) {
    const { from } = this.windows(daysParam);
    const [users, perUser] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          image: true,
          createdAt: true,
          blockedAt: true,
          googleId: true,
          passwordHash: true,
          _count: { select: { conversations: true } },
        },
      }),
      this.prisma.agentRun.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: from } },
        _count: true,
        _sum: { inputTokens: true, outputTokens: true },
        _max: { createdAt: true },
      }),
    ]);
    const stats = new Map(perUser.map((u) => [u.userId, u]));
    const errors = await this.prisma.agentRun.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: from }, status: 'ERROR' },
      _count: true,
    });
    const errMap = new Map(errors.map((e) => [e.userId, e._count]));
    return users.map((u) => {
      const s = stats.get(u.id);
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        image: u.image,
        createdAt: u.createdAt,
        blocked: u.blockedAt !== null,
        blockedAt: u.blockedAt,
        hasPassword: u.passwordHash !== null,
        hasGoogle: u.googleId !== null,
        conversations: u._count.conversations,
        runs: s?._count ?? 0,
        errors: errMap.get(u.id) ?? 0,
        tokens: (s?._sum.inputTokens ?? 0) + (s?._sum.outputTokens ?? 0),
        lastRunAt: s?._max.createdAt ?? null,
      };
    });
  }

  /* ---------- pengelolaan pengguna ---------- */

  private async audit(actor: AuthUser, action: string, target?: { id: string; email: string }, detail?: string) {
    await this.prisma.adminAudit.create({
      data: { actorId: actor.id, actorEmail: actor.email, action, targetId: target?.id, targetEmail: target?.email, detail },
    });
  }

  private async getUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Pengguna tidak ditemukan');
    return user;
  }

  /** Pastikan setelah perubahan masih ada admin aktif lain (agar tidak terkunci dari dashboard). */
  private async assertOtherActiveAdmin(excludeId: string) {
    const others = await this.prisma.user.count({ where: { role: 'ADMIN', blockedAt: null, id: { not: excludeId } } });
    if (others < 1) throw new BadRequestException('Harus tersisa minimal satu admin aktif');
  }

  private assertNotSelf(actor: AuthUser, id: string) {
    if (actor.id === id) throw new BadRequestException('Tindakan ini tidak bisa dilakukan pada akun Anda sendiri');
  }

  async createUser(actor: AuthUser, dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('Email sudah terdaftar');
    const user = await this.prisma.user.create({
      data: { email, name: dto.name?.trim() || null, role: dto.role ?? 'USER', passwordHash: await argon2.hash(dto.password) },
      select: { id: true, email: true, role: true },
    });
    await this.audit(actor, 'user.create', user, `peran ${user.role}`);
    return { id: user.id, email: user.email };
  }

  async updateUser(actor: AuthUser, id: string, dto: UpdateUserDto) {
    const user = await this.getUser(id);
    const data: Prisma.UserUpdateInput = {};
    const log: [string, string?][] = [];

    if (dto.name !== undefined && dto.name.trim() !== (user.name ?? '')) {
      data.name = dto.name.trim() || null;
      log.push(['user.rename', `${user.name ?? '-'} -> ${dto.name.trim() || '-'}`]);
    }
    if (dto.role !== undefined && dto.role !== user.role) {
      this.assertNotSelf(actor, id);
      if (user.role === 'ADMIN' && !user.blockedAt) await this.assertOtherActiveAdmin(id);
      data.role = dto.role;
      log.push(['user.role', `${user.role} -> ${dto.role}`]);
    }
    if (dto.blocked !== undefined && dto.blocked !== (user.blockedAt !== null)) {
      if (dto.blocked) {
        this.assertNotSelf(actor, id);
        if (user.role === 'ADMIN') await this.assertOtherActiveAdmin(id);
        data.blockedAt = new Date();
        log.push(['user.block']);
      } else {
        data.blockedAt = null;
        log.push(['user.unblock']);
      }
    }
    if (log.length === 0) return { changed: false };

    await this.prisma.user.update({ where: { id }, data });
    for (const [action, detail] of log) await this.audit(actor, action, user, detail);
    return { changed: true };
  }

  async resetPassword(actor: AuthUser, id: string, dto: ResetPasswordDto) {
    this.assertNotSelf(actor, id);
    const user = await this.getUser(id);
    await this.prisma.user.update({
      where: { id },
      // Sesi lama ikut berakhir; dibulatkan ke detik karena "iat" token berdetik.
      data: { passwordHash: await argon2.hash(dto.password), sessionsValidAfter: new Date(Math.floor(Date.now() / 1000) * 1000) },
    });
    await this.audit(actor, 'user.reset_password', user);
  }

  async revokeSessions(actor: AuthUser, id: string) {
    this.assertNotSelf(actor, id);
    const user = await this.getUser(id);
    await this.prisma.user.update({ where: { id }, data: { sessionsValidAfter: new Date(Math.floor(Date.now() / 1000) * 1000) } });
    await this.audit(actor, 'user.revoke_sessions', user);
  }

  async deleteUser(actor: AuthUser, id: string) {
    this.assertNotSelf(actor, id);
    const user = await this.getUser(id);
    if (user.role === 'ADMIN' && !user.blockedAt) await this.assertOtherActiveAdmin(id);
    await this.prisma.user.delete({ where: { id } });
    // Workspace yang tak punya anggota lagi ikut dibersihkan (beserta percakapan dan catatannya).
    await this.prisma.workspace.deleteMany({ where: { memberships: { none: {} } } });
    await this.audit(actor, 'user.delete', user);
  }

  auditLog(take = 30) {
    return this.prisma.adminAudit.findMany({ orderBy: { createdAt: 'desc' }, take });
  }
}
