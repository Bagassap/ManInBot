import type { SheetEvent } from '../workbooks/types.js';

/** Kejadian yang dialirkan ke pengguna saat agen meminta izin. */
export type ApprovalEvent =
  | { type: 'approval_request'; id: string; tool: string; summary: string; detail: string | null }
  | { type: 'approval_result'; id: string; approved: boolean };

export interface LocalCtx {
  userId: string;
  userEmail: string;
  workspaceId: string;
  conversationId: string;
  signal: AbortSignal;
  emit: (e: ApprovalEvent | SheetEvent) => void;
}
