import type Anthropic from '@anthropic-ai/sdk';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const DEFAULT_TITLE = 'Percakapan baru';
const HISTORY_LIMIT = 40;

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(workspaceId: string, userId: string) {
    return this.prisma.conversation.findMany({
      where: { workspaceId, userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, updatedAt: true },
      take: 100,
    });
  }

  create(workspaceId: string, userId: string) {
    return this.prisma.conversation.create({
      data: { workspaceId, userId },
      select: { id: true, title: true, updatedAt: true },
    });
  }

  /** Mengembalikan percakapan hanya bila dimiliki userId; selain itu 404 (tidak membocorkan keberadaan). */
  async getOwned(workspaceId: string, userId: string, id: string) {
    const conv = await this.prisma.conversation.findFirst({ where: { id, userId, workspaceId } });
    if (!conv) throw new NotFoundException('Percakapan tidak ditemukan');
    return conv;
  }

  async getWithMessages(workspaceId: string, userId: string, id: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id, userId, workspaceId },
      select: {
        id: true,
        title: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, role: true, content: true, steps: true, createdAt: true },
        },
      },
    });
    if (!conv) throw new NotFoundException('Percakapan tidak ditemukan');
    return conv;
  }

  async remove(workspaceId: string, userId: string, id: string) {
    await this.getOwned(workspaceId, userId, id);
    await this.prisma.conversation.delete({ where: { id } });
  }

  async addUserMessage(conversationId: string, content: string, currentTitle: string) {
    const message = await this.prisma.message.create({
      data: { conversationId, role: 'USER', content },
    });
    if (currentTitle === DEFAULT_TITLE) {
      const title = content.replace(/\s+/g, ' ').trim().slice(0, 50);
      await this.prisma.conversation.update({ where: { id: conversationId }, data: { title } });
    } else {
      await this.prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    }
    return message;
  }

  recordRun(data: {
    workspaceId: string;
    userId: string;
    conversationId: string;
    model: string;
    status: 'SUCCESS' | 'ERROR' | 'ABORTED';
    durationMs: number;
    inputTokens: number;
    outputTokens: number;
    toolCalls: number;
    error: string | null;
    prompt: string;
  }) {
    return this.prisma.agentRun.create({ data });
  }

  async addAssistantMessage(conversationId: string, content: string, steps: unknown[]) {
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        role: 'ASSISTANT',
        content,
        steps: steps.length ? (steps as Prisma.InputJsonValue) : undefined,
      },
      select: { id: true, role: true, content: true, steps: true, createdAt: true },
    });
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    return message;
  }

  /** Riwayat teks untuk dikirim ke model (tanpa blok alat; cukup konteks percakapan). */
  async history(conversationId: string): Promise<Anthropic.MessageParam[]> {
    const rows = await this.prisma.message.findMany({
      where: { conversationId, role: { in: ['USER', 'ASSISTANT'] } },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
      select: { role: true, content: true },
    });
    return rows
      .reverse()
      .filter((m) => m.content.trim().length > 0)
      .map((m) => ({ role: m.role === 'USER' ? ('user' as const) : ('assistant' as const), content: m.content }));
  }
}
