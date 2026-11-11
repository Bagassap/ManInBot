import Anthropic from '@anthropic-ai/sdk';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AgentService, type AgentStep, type RunUsage } from '../agent/agent.service.js';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { AuditService } from '../workspaces/audit.service.js';
import { CurrentWorkspace, WorkspaceGuard, type WorkspaceAccess } from '../workspaces/workspace.guard.js';
import { SendMessageDto } from './conversations.dto.js';
import { ConversationsService } from './conversations.service.js';

@Controller('workspaces/:workspaceId/conversations')
@UseGuards(AuthGuard, WorkspaceGuard)
export class ConversationsController {
  private readonly logger = new Logger(ConversationsController.name);

  constructor(
    private readonly conversations: ConversationsService,
    private readonly agent: AgentService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @CurrentWorkspace() ws: WorkspaceAccess) {
    return this.conversations.list(ws.workspaceId, user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @CurrentWorkspace() ws: WorkspaceAccess) {
    return this.conversations.create(ws.workspaceId, user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @CurrentWorkspace() ws: WorkspaceAccess, @Param('id', ParseUUIDPipe) id: string) {
    return this.conversations.getWithMessages(ws.workspaceId, user.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @CurrentWorkspace() ws: WorkspaceAccess, @Param('id', ParseUUIDPipe) id: string) {
    return this.conversations.remove(ws.workspaceId, user.id, id);
  }

  /** Mode Perintah: kirim perintah, agen mengeksekusi, hasil dialirkan sebagai SSE. */
  @Post(':id/messages')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async send(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ws: WorkspaceAccess,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
    @Res() res: Response,
  ) {
    const conv = await this.conversations.getOwned(ws.workspaceId, user.id, id);
    if (!this.agent.enabled) {
      throw new ServiceUnavailableException('Agen belum aktif: Anda belum masuk ke akun MiB. Buka Pengaturan untuk masuk.');
    }

    const userMessage = await this.conversations.addUserMessage(
      id,
      dto.content,
      conv.title,
    );
    const history = await this.conversations.history(id);

    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const send = (data: unknown) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) abort.abort();
    });

    send({ type: 'start', userMessage: { id: userMessage.id, content: userMessage.content } });

    let text = '';
    let steps: AgentStep[] = [];
    // Catatan untuk dashboard admin: status, durasi, token, dan jumlah langkah alat.
    const startedAt = Date.now();
    const usage: RunUsage = { inputTokens: 0, outputTokens: 0 };
    let toolCalls = 0;
    let status: 'SUCCESS' | 'ERROR' | 'ABORTED' = 'SUCCESS';
    let failure: string | null = null;
    try {
      const result = await this.agent.run(
        history,
        (event) => {
          if (event.type === 'tool_start') toolCalls++;
          send(event);
        },
        abort.signal,
        usage,
        { userId: user.id, userEmail: user.email, workspaceId: ws.workspaceId, conversationId: id },
      );
      text = result.text;
      steps = result.steps;
    } catch (err) {
      if (abort.signal.aborted) {
        status = 'ABORTED';
      } else {
        status = 'ERROR';
        failure = err instanceof Error ? `${err.name}: ${err.message}`.slice(0, 300) : 'Galat tidak dikenal';
        this.logger.error(err instanceof Error ? err.stack : String(err));
        // Pesan dari gateway MiB (kode salah, dicabut, kedaluwarsa, kuota habis) sudah berbahasa Indonesia dan aman ditampilkan.
        const gateway =
          err instanceof Anthropic.APIError && [401, 403, 429].includes(err.status ?? 0)
            ? ((err.error as { error?: { message?: string } } | undefined)?.error?.message ?? null)
            : null;
        const message = gateway ?? 'Terjadi kesalahan saat menjalankan agen.';
        send({ type: 'error', message });
      }
    }

    if (text || steps.length) {
      const saved = await this.conversations.addAssistantMessage(id, text || '(tanpa jawaban teks)', steps);
      send({ type: 'done', message: saved });
    }
    res.end();

    // Pencatatan tidak boleh mengganggu jawaban ke pengguna.
    await this.conversations
      .recordRun({
        workspaceId: ws.workspaceId,
        userId: user.id,
        conversationId: id,
        model: this.agent.modelName,
        status,
        durationMs: Date.now() - startedAt,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        toolCalls,
        error: failure,
        prompt: dto.content.slice(0, 500),
      })
      .catch((e: unknown) => this.logger.warn(`Gagal mencatat run: ${e instanceof Error ? e.message : String(e)}`));
    await this.audit.log({
      workspaceId: ws.workspaceId,
      actorId: user.id,
      actorEmail: user.email,
      action: 'agent.run',
      target: id,
      detail: `${status} · ${toolCalls} langkah alat · ${dto.content.slice(0, 120)}`,
    });
  }
}
