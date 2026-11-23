"use client";

import { Brain, CheckCircle2, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type Tier = "ringan" | "sedang" | "kuat";

interface TierInfo {
  model: string;
  label: string;
  forCpu: string;
  downloadGb: number;
}
export interface BrainStatus {
  ready: boolean;
  tier: Tier | null;
  model: string | null;
  detected: { tier: Tier; pc: string } | null;
  tiers: Record<Tier, TierInfo>;
  job: { running: boolean; phase: string; pct: number | null; message: string; error: string | null };
}

const ORDER: Tier[] = ["ringan", "sedang", "kuat"];

/** Status otak lokal, pilihan model, dan pemasangan/pelanjutan unduhan. */
export default function BrainPanel({ isAdmin, onReady }: { isAdmin: boolean; onReady?: () => void }) {
  const [s, setS] = useState<BrainStatus | null>(null);
  const [picked, setPicked] = useState<Tier | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const next = await api<BrainStatus>("/brain");
    setS((prev) => {
      if (prev?.job.running && !next.job.running && next.ready) onReady?.();
      return next;
    });
  }, [onReady]);

  useEffect(() => {
    api<BrainStatus>("/brain")
      .then(setS)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Gagal memuat status"));
  }, []);

  const running = s?.job.running ?? false;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => void load().catch(() => undefined), 1500);
    return () => clearInterval(t);
  }, [running, load]);

  if (!s) return <p className="animate-pulse text-sm text-muted">{error || "Memuat…"}</p>;

  const tier = picked ?? s.tier ?? s.detected?.tier ?? "sedang";
  const changing = s.ready && tier !== s.tier;

  const start = async () => {
    setError("");
    try {
      await api("/brain/setup", { method: "POST", body: JSON.stringify({ tier }) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memulai pemasangan");
    }
  };
  const cancel = () => void api("/brain/cancel", { method: "POST" }).then(load).catch(() => undefined);

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-medium">
          <Brain className="size-4 text-accent-strong" /> Otak MiB
        </h2>
        {s.ready ? (
          <span className="flex items-center gap-1 text-xs text-accent-strong">
            <CheckCircle2 className="size-3.5" /> Siap, offline
          </span>
        ) : (
          <span className="text-xs text-muted">Belum dipasang</span>
        )}
      </div>
      <p className="mt-2 text-sm text-muted">
        MiB berjalan di komputer ini. Isi pekerjaan Anda tidak dikirim ke internet.
        {s.detected ? ` Terdeteksi: ${s.detected.pc}.` : ""}
      </p>

      <div className="mt-4 space-y-2" role="radiogroup" aria-label="Pilih model">
        {ORDER.map((t) => {
          const info = s.tiers[t];
          return (
            <label
              key={t}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${tier === t ? "border-accent bg-accent/10" : "border-line hover:bg-white/5"}`}
            >
              <input type="radio" name="tier" className="accent-[var(--accent)]" checked={tier === t} disabled={running || !isAdmin} onChange={() => setPicked(t)} />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{info.label}</span>
                <span className="text-muted"> · {info.forCpu}</span>
                {s.detected?.tier === t && <span className="ml-2 text-xs text-accent-strong">Disarankan</span>}
                {s.tier === t && s.ready && <span className="ml-2 text-xs text-muted">Dipakai</span>}
              </span>
              <span className="shrink-0 text-xs text-muted">±{info.downloadGb} GB</span>
            </label>
          );
        })}
      </div>

      {running && (
        <div className="mt-4">
          <p className="text-sm">{s.job.message}{s.job.pct !== null ? ` ${s.job.pct}%` : ""}</p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
            <div className={`h-full rounded-full bg-accent transition-all ${s.job.pct === null ? "w-1/3 animate-pulse" : ""}`} style={s.job.pct === null ? undefined : { width: `${s.job.pct}%` }} />
          </div>
        </div>
      )}
      {(error || s.job.error) && !running && (
        <p role="alert" className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error || s.job.error}</p>
      )}

      {isAdmin && (
        <div className="mt-4 flex gap-2">
          {running ? (
            <button onClick={cancel} className="flex h-10 items-center gap-2 rounded-xl border border-line px-4 text-sm hover:bg-white/5">
              <Loader2 className="size-4 animate-spin" /> Batalkan
            </button>
          ) : (
            (!s.ready || changing) && (
              <button onClick={() => void start()} className="h-10 rounded-xl bg-accent px-4 text-sm font-medium text-[#0d1417] hover:bg-accent-strong">
                {changing ? "Ganti ke model ini" : s.job.error ? "Lanjutkan pemasangan" : "Pasang sekarang"}
              </button>
            )
          )}
        </div>
      )}
    </section>
  );
}
