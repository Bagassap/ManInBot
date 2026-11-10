import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../workspaces/audit.service.js';
import type { LocalCtx } from './types.js';

/** Lama menunggu jawaban pengguna sebelum permintaan dianggap ditolak. */
export const APPROVAL_TIMEOUT_MS = 5 * 60_000;

interface Waiter {
  workspaceId: string;
  userId: string;
  userEmail: string;
  tool: string;
  settle: (approved: boolean, status: 'APPROVED' | 'DENIED' | 'EXPIRED') => void;
}

/**
 * Persetujuan manusia untuk tindakan berdampak. Agen berhenti menunggu sampai pengguna menjawab (atau waktu habis,
 * atau pengguna memutus koneksi) dan baru melanjutkan bila disetujui. Setiap permintaan dicatat di tabel Approval
 * dan di audit workspace, apa pun jawabannya.
 */
@Injectable()
export class ApprovalsService {
  private readonly waiting = new Map<string, Waiter>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async request(ctx: LocalCtx, req: { tool: string; summary: string; detail?: string }): Promise<boolean> {
    if (ctx.signal.aborted) return false;
    const id = randomUUID();
    await this.prisma.approval.create({
      data: {
        id,
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        tool: req.tool,
        summary: req.summary.slice(0, 500),
        detail: req.detail?.slice(0, 4000) ?? null,
      },
    });
    await this.audit.log({
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      actorEmail: ctx.userEmail,
      action: 'approval.requested',
      target: req.tool,
      detail: req.summary,
    });

    return new Promise<boolean>((resolve) => {
      let timer: NodeJS.Timeout;
      const settle = (approved: boolean, status: 'APPROVED' | 'DENIED' | 'EXPIRED') => {
        if (!this.waiting.delete(id)) return;
        clearTimeout(timer);
        ctx.signal.removeEventListener('abort', onAbort);
        ctx.emit({ type: 'approval_result', id, approved });
        void this.prisma.approval
          .update({ where: { id }, data: { status, decidedAt: new Date() } })
          .then(() =>
            this.audit.log({
              workspaceId: ctx.workspaceId,
              actorId: ctx.userId,
              actorEmail: ctx.userEmail,
              action: `approval.${status.toLowerCase()}`,
              target: req.tool,
              detail: req.summary,
            }),
          )
          .catch(() => undefined);
        resolve(approved);
      };
      const onAbort = () => settle(false, 'EXPIRED');
      timer = setTimeout(() => settle(false, 'EXPIRED'), APPROVAL_TIMEOUT_MS);
      ctx.signal.addEventListener('abort', onAbort, { once: true });
      this.waiting.set(id, {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        userEmail: ctx.userEmail,
        tool: req.tool,
        settle,
      });
      ctx.emit({ type: 'approval_request', id, tool: req.tool, summary: req.summary, detail: req.detail ?? null });
    });
  }

  /** Jawaban pengguna. Hanya pemilik run (di workspace yang sama) yang boleh menjawab; selain itu 404. */
  decide(workspaceId: string, userId: string, id: string, allow: boolean) {
    const w = this.waiting.get(id);
    if (!w || w.workspaceId !== workspaceId || w.userId !== userId) {
      throw new NotFoundException('Permintaan izin tidak ditemukan atau sudah selesai');
    }
    w.settle(allow, allow ? 'APPROVED' : 'DENIED');
    return { ok: true };
  }

  /** Riwayat permintaan izin milik pengguna di workspace ini. */
  history(workspaceId: string, userId: string, take = 50) {
    return this.prisma.approval.findMany({
      where: { workspaceId, userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 200),
    });
  }
}
