import type { SheetEventPatch, SheetSnapshot } from "./sheet";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
}

export interface ConversationItem {
  id: string;
  title: string;
  updatedAt: string;
}

export interface Step {
  id: string;
  name: string;
  input: unknown;
  output: string;
  isError: boolean;
}

export interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  steps?: Step[] | null;
}

function errorMessage(body: unknown, fallback: string) {
  const m = (body as { message?: string | string[] } | null)?.message;
  return Array.isArray(m) ? m[0] : (m ?? fallback);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok)
    throw new ApiError(res.status, errorMessage(body, "Terjadi kesalahan"));
  return body as T;
}

export type StreamEvent =
  | { type: "start"; userMessage: { id: string; content: string } }
  | { type: "text"; delta: string }
  | { type: "tool_start"; id: string; name: string; input: unknown }
  | { type: "tool_result"; id: string; output: string; isError: boolean }
  | { type: "approval_request"; id: string; tool: string; summary: string; detail: string | null }
  | { type: "approval_result"; id: string; approved: boolean }
  | { type: "sheet_reset"; snapshot: SheetSnapshot }
  | SheetEventPatch
  | { type: "done"; message: ChatMessage }
  | { type: "error"; message: string };

/** Mengirim perintah dan membaca aliran SSE dari agen. */
export async function streamMessage(
  workspaceId: string,
  conversationId: string,
  content: string,
  onEvent: (e: StreamEvent) => void,
  signal: AbortSignal,
) {
  const res = await fetch(
    `${API_URL}/workspaces/${workspaceId}/conversations/${conversationId}/messages`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
      signal,
    },
  );
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      errorMessage(body, "Gagal mengirim perintah"),
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const line = frame.split("\n").find((l) => l.startsWith("data: "));
      if (line) onEvent(JSON.parse(line.slice(6)) as StreamEvent);
    }
  }
}
