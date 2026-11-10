import { api, type Step } from "./api";

export type RunStatus = "SUCCESS" | "ERROR" | "ABORTED";

export interface AdminOverview {
  days: number;
  kpis: {
    runs: { value: number; delta: number | null };
    errors: { value: number; rate: number; delta: number | null };
    latency: { avgMs: number; delta: number | null };
    tokens: {
      total: number;
      input: number;
      output: number;
      toolCalls: number;
      delta: number | null;
    };
    users: { total: number; new: number; active: number };
    conversations: number;
  };
  series: {
    date: string;
    runs: number;
    errors: number;
    avgLatencyMs: number;
  }[];
  models: {
    model: string;
    runs: number;
    inputTokens: number;
    outputTokens: number;
  }[];
}

export interface AdminRunItem {
  id: string;
  createdAt: string;
  status: RunStatus;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  toolCalls: number;
  model: string;
  prompt: string;
  conversationId: string | null;
  user: { id: string; email: string; name: string | null };
}

export interface AdminRuns {
  counts: { ALL: number; SUCCESS: number; ERROR: number; ABORTED: number };
  items: AdminRunItem[];
}

export interface AdminRunDetail {
  run: AdminRunItem & {
    error: string | null;
    user: AdminRunItem["user"] & { image: string | null };
  };
  messages: {
    id: string;
    role: "USER" | "ASSISTANT" | "SYSTEM";
    content: string;
    steps: Step[] | null;
    createdAt: string;
  }[];
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
  image: string | null;
  createdAt: string;
  blocked: boolean;
  blockedAt: string | null;
  hasPassword: boolean;
  hasGoogle: boolean;
  conversations: number;
  runs: number;
  errors: number;
  tokens: number;
  lastRunAt: string | null;
}

export interface AuditEntry {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetId: string | null;
  targetEmail: string | null;
  detail: string | null;
  createdAt: string;
}

export interface RunFilters {
  days: number;
  status: RunStatus | "ALL";
  userId: string;
  q: string;
}

const qs = (o: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o))
    if (v !== undefined && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const adminApi = {
  overview: (days: number) =>
    api<AdminOverview>(`/admin/overview${qs({ days })}`),
  runs: (f: RunFilters) =>
    api<AdminRuns>(
      `/admin/runs${qs({ days: f.days, status: f.status === "ALL" ? undefined : f.status, userId: f.userId, q: f.q.trim(), take: 60 })}`,
    ),
  runDetail: (id: string) => api<AdminRunDetail>(`/admin/runs/${id}`),
  users: (days: number) => api<AdminUser[]>(`/admin/users${qs({ days })}`),
  audit: () => api<AuditEntry[]>("/admin/audit"),
  createUser: (b: {
    email: string;
    password: string;
    name?: string;
    role: "USER" | "ADMIN";
  }) =>
    api<{ id: string; email: string }>("/admin/users", {
      method: "POST",
      body: JSON.stringify(b),
    }),
  updateUser: (
    id: string,
    b: { role?: "USER" | "ADMIN"; blocked?: boolean; name?: string },
  ) =>
    api<{ changed: boolean }>(`/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(b),
    }),
  resetPassword: (id: string, password: string) =>
    api<void>(`/admin/users/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  revokeSessions: (id: string) =>
    api<void>(`/admin/users/${id}/revoke-sessions`, { method: "POST" }),
  deleteUser: (id: string) =>
    api<void>(`/admin/users/${id}`, { method: "DELETE" }),
};

/** Kata sandi acak (tanpa karakter yang mudah tertukar seperti 0/O dan 1/l/I). */
export function randomPassword(n = 14) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const a = new Uint32Array(n);
  crypto.getRandomValues(a);
  return Array.from(a, (v) => chars[v % chars.length]).join("");
}

export const AUDIT_LABEL: Record<string, string> = {
  "user.create": "membuat akun",
  "user.role": "mengubah peran",
  "user.rename": "mengubah nama",
  "user.block": "memblokir",
  "user.unblock": "membuka blokir",
  "user.reset_password": "mereset kata sandi",
  "user.revoke_sessions": "mengakhiri semua sesi",
  "user.delete": "menghapus akun",
};

/* ---------- pemformat ---------- */

const nf = new Intl.NumberFormat("id-ID");
export const fmtInt = (n: number) => nf.format(Math.round(n));

export function fmtCompact(n: number) {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} jt`;
  if (n >= 10_000)
    return `${(n / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} rb`;
  return fmtInt(n);
}

export function fmtDuration(ms: number) {
  if (ms < 1000) return `${Math.round(ms)} md`;
  const s = ms / 1000;
  if (s < 60)
    return `${s.toLocaleString("id-ID", { maximumFractionDigits: 1 })} dtk`;
  return `${Math.floor(s / 60)} mnt ${Math.round(s % 60)} dtk`;
}

const rtf = new Intl.RelativeTimeFormat("id", { numeric: "auto" });
export function fmtAgo(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "baru saja";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export const initials = (u: { name: string | null; email: string }) =>
  (u.name || u.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

export const STATUS_LABEL: Record<RunStatus, string> = {
  SUCCESS: "Berhasil",
  ERROR: "Gagal",
  ABORTED: "Dibatalkan",
};

/** Gabungkan deret harian menjadi paling banyak `max` kelompok (jumlah perintah dijumlah, latensi dirata-rata berbobot). */
export function bucketSeries(series: AdminOverview["series"], max = 14) {
  const size = Math.max(1, Math.ceil(series.length / max));
  const out: {
    label: string;
    runs: number;
    errors: number;
    avgLatencyMs: number;
  }[] = [];
  for (let i = 0; i < series.length; i += size) {
    const g = series.slice(i, i + size);
    const runs = g.reduce((a, b) => a + b.runs, 0);
    const lat = g.reduce((a, b) => a + b.avgLatencyMs * b.runs, 0);
    out.push({
      label: new Date(g[0].date + "T00:00:00").toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
      }),
      runs,
      errors: g.reduce((a, b) => a + b.errors, 0),
      avgLatencyMs: runs ? lat / runs : 0,
    });
  }
  return out;
}

/** Ekspor CSV. Sel yang diawali = + - @ diberi apostrof agar tidak dijalankan sebagai rumus di Excel (CSV injection). */
export function runsToCsv(items: AdminRunItem[]) {
  const cell = (v: string | number) => {
    let s = String(v).replace(/\r?\n/g, " ");
    if (/^[=+\-@\t]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const head = [
    "waktu",
    "pengguna",
    "email",
    "status",
    "durasi_ms",
    "token_masuk",
    "token_keluar",
    "langkah_alat",
    "model",
    "perintah",
  ];
  const rows = items.map((r) =>
    [
      r.createdAt,
      r.user.name ?? "",
      r.user.email,
      r.status,
      r.durationMs,
      r.inputTokens,
      r.outputTokens,
      r.toolCalls,
      r.model,
      r.prompt,
    ]
      .map(cell)
      .join(","),
  );
  return "﻿" + [head.join(","), ...rows].join("\r\n");
}
