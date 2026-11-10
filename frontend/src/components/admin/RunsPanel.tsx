"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  Copy,
  Cpu,
  Inbox,
  MoreVertical,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import {
  fmtAgo,
  fmtDateTime,
  fmtDuration,
  fmtInt,
  initials,
  STATUS_LABEL,
  type AdminRunDetail,
  type AdminRunItem,
  type AdminRuns,
  type RunStatus,
} from "@/lib/admin-api";

const STATUS_STYLE: Record<RunStatus, string> = {
  SUCCESS: "bg-emerald-400/15 text-emerald-300",
  ERROR: "bg-rose-400/15 text-rose-300",
  ABORTED: "bg-amber-400/15 text-amber-300",
};

const TABS: { key: RunStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "Semua" },
  { key: "SUCCESS", label: "Berhasil" },
  { key: "ERROR", label: "Gagal" },
  { key: "ABORTED", label: "Batal" },
];

function Avatar({
  u,
  size = 36,
}: {
  u: { name: string | null; email: string };
  size?: number;
}) {
  return (
    <span
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white ring-1 ring-white/15"
    >
      {initials(u)}
    </span>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        });
      }}
      className="flex size-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
    >
      {done ? <Check className="size-4" /> : <Copy className="size-4" />}
    </button>
  );
}

export default function RunsPanel({
  runs,
  loading,
  status,
  onStatus,
  activeId,
  onSelect,
  detail,
  detailLoading,
}: {
  runs: AdminRuns | null;
  loading: boolean;
  status: RunStatus | "ALL";
  onStatus: (s: RunStatus | "ALL") => void;
  activeId: string | null;
  onSelect: (id: string) => void;
  detail: AdminRunDetail | null;
  detailLoading: boolean;
}) {
  const items = runs?.items ?? [];

  return (
    <section
      aria-label="Perintah agen"
      className="relative rounded-[28px] bg-[#1c1b38] p-4 text-white sm:p-6"
    >
      {/* tab status melayang di tengah, seperti pada gambar acuan */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white sm:text-lg">
          Perintah agen
        </h2>
        <div
          role="tablist"
          aria-label="Filter status"
          className="order-3 flex w-full max-w-full overflow-x-auto rounded-2xl bg-white p-1 text-[#14142b] shadow-lg shadow-black/20 sm:order-none sm:w-auto"
        >
          {TABS.map((t) => {
            const on = status === t.key;
            const n = runs?.counts[t.key] ?? 0;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={on}
                onClick={() => onStatus(t.key)}
                className={`relative flex-1 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors sm:flex-none sm:px-4 ${on ? "text-white" : "text-[#70728f] hover:text-[#14142b]"}`}
              >
                {on && (
                  <motion.span
                    layoutId="runs-tab"
                    className="absolute inset-0 rounded-xl bg-accent"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  {t.label}
                  <span
                    className={`rounded-full px-1.5 text-[10px] ${on ? "bg-white/25" : "bg-[#14142b]/8"}`}
                  >
                    {fmtInt(n)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <button
          aria-label="Menu lainnya"
          className="hidden size-9 items-center justify-center rounded-xl bg-white/8 text-white/70 sm:flex"
        >
          <MoreVertical className="size-4" />
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* daftar */}
        <div
          className={`flex max-h-[520px] flex-col gap-2 overflow-y-auto pr-1 transition-opacity ${loading ? "opacity-60" : ""}`}
        >
          {items.length === 0 && !loading && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 py-16 text-center text-sm text-white/60">
              <Inbox className="size-8 text-white/40" />
              <p>Belum ada perintah agen pada filter ini.</p>
              <p className="max-w-xs text-xs text-white/40">
                Perintah muncul di sini setelah pengguna mulai memakai agen di
                halaman chat.
              </p>
            </div>
          )}
          {items.map((r, i) => {
            const on = r.id === activeId;
            return (
              <motion.button
                key={r.id}
                type="button"
                onClick={() => onSelect(r.id)}
                aria-pressed={on}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(i, 8) * 0.03 }}
                className={`flex items-center gap-3 rounded-2xl p-3 text-left transition-colors ${on ? "bg-accent shadow-lg shadow-accent/30" : "bg-white/5 hover:bg-white/10"}`}
              >
                <Avatar u={r.user} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {r.user.name || r.user.email}
                  </span>
                  <span
                    className={`block truncate text-xs ${on ? "text-white/80" : "text-white/50"}`}
                  >
                    {r.prompt}
                  </span>
                  <span
                    className={`block text-[11px] ${on ? "text-white/70" : "text-white/40"}`}
                  >
                    {fmtAgo(r.createdAt)}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${on ? "bg-white text-accent" : STATUS_STYLE[r.status]}`}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                  <span className="text-xs tabular-nums text-white/70">
                    {fmtDuration(r.durationMs)}
                  </span>
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* rincian */}
        <div className="relative min-h-[320px] overflow-hidden rounded-3xl bg-gradient-to-br from-[#5b47f5] via-[#5340e0] to-[#7466f6] p-5 sm:p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-white/10 blur-3xl"
          />
          <AnimatePresence mode="wait">
            {detail ? (
              <Detail key={detail.run.id} detail={detail} dim={detailLoading} />
            ) : (
              <motion.p
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative flex h-full min-h-[280px] items-center justify-center text-sm text-white/70"
              >
                {detailLoading
                  ? "Memuat rincian…"
                  : "Pilih satu perintah untuk melihat rinciannya."}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function Detail({ detail, dim }: { detail: AdminRunDetail; dim: boolean }) {
  const { run, messages } = detail;
  const answer = [...messages].reverse().find((m) => m.role === "ASSISTANT");
  const steps = answer?.steps ?? [];
  const totalTokens = run.inputTokens + run.outputTokens;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: dim ? 0.6 : 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35 }}
      className="relative flex h-full flex-col gap-5"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-white/70">Rincian perintah</p>
          <p className="mt-1 flex items-center gap-2 text-lg font-semibold">
            #{run.id.slice(0, 8)}
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${run.status === "SUCCESS" ? "bg-white/20 text-white" : run.status === "ERROR" ? "bg-rose-300/25 text-rose-100" : "bg-amber-300/25 text-amber-100"}`}
            >
              {STATUS_LABEL[run.status]}
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs text-white/70">Model</p>
          <p className="mt-1 flex items-center gap-1.5 text-lg font-semibold">
            <Cpu className="size-4 text-white/80" />
            {run.model}
          </p>
        </div>
        <div>
          <p className="text-xs text-white/70">Pengguna</p>
          <div className="mt-1 flex items-center gap-2.5">
            <Avatar u={run.user} size={34} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {run.user.name || run.user.email}
              </p>
              <p className="truncate text-xs text-white/70">{run.user.email}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white/12 p-4">
        <p className="text-xs text-white/70">
          Perintah pengguna · {fmtDateTime(run.createdAt)}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed">{run.prompt || "—"}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Durasi", value: fmtDuration(run.durationMs) },
          { label: "Token masuk", value: fmtInt(run.inputTokens) },
          { label: "Token keluar", value: fmtInt(run.outputTokens) },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl bg-white/15 p-3.5">
            <p className="text-lg font-semibold tabular-nums">{c.value}</p>
            <p className="mt-1 text-[11px] text-white/70">{c.label}</p>
          </div>
        ))}
        <div className="flex flex-col justify-center rounded-2xl border border-dashed border-white/40 p-3.5">
          <p className="flex items-center gap-1.5 text-lg font-semibold tabular-nums">
            <Wrench className="size-4 text-white/80" />
            {run.toolCalls}
          </p>
          <p className="mt-1 text-[11px] text-white/70">Langkah alat</p>
        </div>
      </div>

      {run.status === "ERROR" && (
        <div className="flex items-start gap-3 rounded-2xl bg-rose-500/25 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-100" />
          <div>
            <p className="font-medium">Perintah gagal</p>
            <p className="mt-0.5 break-words text-xs text-rose-100/90">
              {run.error || "Penyebab tidak tercatat."}
            </p>
          </div>
        </div>
      )}

      {answer && (
        <div className="rounded-2xl bg-white/12 p-4">
          <p className="text-xs text-white/70">Jawaban agen</p>
          <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed">
            {answer.content}
          </p>
          {steps.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {steps.map((s) => (
                <li
                  key={s.id}
                  className="rounded-lg bg-white/15 px-2.5 py-1 font-mono text-[11px]"
                  title={JSON.stringify(s.input)}
                >
                  {s.name} → {s.output.slice(0, 24)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-end justify-between gap-4 border-t border-white/20 pt-4">
        <div className="flex gap-6 text-sm">
          <div>
            <p className="text-[11px] text-white/70">Total token</p>
            <p className="text-lg font-semibold tabular-nums">
              {fmtInt(totalTokens)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-white/70">Durasi</p>
            <p className="text-lg font-semibold tabular-nums">
              {fmtDuration(run.durationMs)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-white/70">Langkah alat</p>
            <p className="text-lg font-semibold tabular-nums">
              {run.toolCalls}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <CopyButton text={run.id} label="Salin ID run" />
          <CopyButton text={run.prompt} label="Salin perintah" />
        </div>
      </div>
    </motion.div>
  );
}

export type { AdminRunItem };
