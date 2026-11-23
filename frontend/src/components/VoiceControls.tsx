"use client";

import { Loader2, Mic, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { record, speak, stopSpeaking, transcribe, type Recording, type VoiceStatus } from "@/lib/voice";

const KEY = "mib-voice-reply";

/** Tombol mikrofon dan speaker. `reply` berisi jawaban terbaru yang perlu dibacakan. */
export default function VoiceControls({
  disabled,
  reply,
  onText,
  onError,
}: {
  disabled: boolean;
  reply: { id: string; text: string } | null;
  onText: (text: string) => void;
  onError: (message: string) => void;
}) {
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const [state, setState] = useState<"idle" | "listening" | "thinking">("idle");
  const [replyOn, setReplyOn] = useState(false);
  const [offer, setOffer] = useState(false);
  const rec = useRef<Recording | null>(null);
  const spoken = useRef<string | null>(null);

  const load = useCallback(() => api<VoiceStatus>("/voice").then(setStatus), []);

  useEffect(() => {
    load().catch(() => undefined);
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReplyOn(localStorage.getItem(KEY) === "1");
    } catch {
      /* penyimpanan tidak tersedia */
    }
    return () => {
      rec.current?.cancel();
      stopSpeaking();
    };
  }, [load]);

  const running = status?.job.running ?? false;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => void load().catch(() => undefined), 1200);
    return () => clearInterval(t);
  }, [running, load]);

  useEffect(() => {
    if (!reply || !replyOn || !status?.ttsReady || spoken.current === reply.id) return;
    spoken.current = reply.id;
    speak(reply.text).catch(() => onError("Jawaban tidak bisa dibacakan."));
  }, [reply, replyOn, status?.ttsReady, onError]);

  async function mic() {
    if (state === "listening") return rec.current?.stop();
    if (state !== "idle" || disabled) return;
    if (!status?.sttReady) return setOffer(true);
    stopSpeaking();
    try {
      const r = await record();
      rec.current = r;
      setState("listening");
      const wav = await r.result;
      rec.current = null;
      if (!wav) return setState("idle");
      setState("thinking");
      const text = await transcribe(wav);
      if (text) onText(text);
      else onError("Suara tidak terdengar jelas. Coba lagi.");
    } catch (e) {
      const denied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "NotFoundError");
      onError(denied ? "Mikrofon tidak ditemukan atau belum diizinkan di Pengaturan Windows." : e instanceof Error ? e.message : "Suara gagal diproses.");
    } finally {
      setState("idle");
    }
  }

  function toggleReply() {
    const next = !replyOn;
    if (next && !status?.ttsReady) {
      setOffer(true);
      void load().catch(() => undefined);
      return;
    }
    if (!next) stopSpeaking();
    // Jawaban yang sudah tampil tidak dibacakan mendadak saat speaker dinyalakan.
    if (next) spoken.current = reply?.id ?? null;
    setReplyOn(next);
    try {
      localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      /* penyimpanan tidak tersedia */
    }
  }

  async function install() {
    try {
      await api("/voice/setup", { method: "POST" });
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Gagal memasang suara.");
    }
  }

  const job = status?.job;
  return (
    <>
      {offer && status && (!status.sttReady || !status.ttsReady) && (
        <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-line bg-surface p-3 text-sm shadow-lg">
          {!status.sttReady && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted">
                {job?.running ? `${job.message}${job.pct != null ? ` ${job.pct}%` : ""}` : job?.error || "Agar MiB bisa mendengar, pasang paket suara offline (70 sampai 200 MB)."}
              </span>
              {!job?.running && (
                <button type="button" onClick={install} className="rounded-lg bg-accent px-3 py-1.5 font-medium text-[#0d1417] hover:bg-accent-strong">
                  Pasang
                </button>
              )}
            </div>
          )}
          {!status.ttsReady && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 first:mt-0">
              <span className="text-muted">Agar MiB bisa berbicara, tambahkan suara &quot;Indonesian&quot; di Pengaturan Windows.</span>
              <button
                type="button"
                onClick={() => void api("/voice/open-settings", { method: "POST" }).then(load)}
                className="rounded-lg border border-line px-3 py-1.5 hover:bg-line"
              >
                Buka Pengaturan
              </button>
            </div>
          )}
          <button type="button" onClick={() => setOffer(false)} className="mt-2 text-xs text-muted hover:text-foreground">
            Tutup
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={toggleReply}
        aria-label={replyOn ? "Matikan suara MiB" : "Nyalakan suara MiB"}
        aria-pressed={replyOn}
        title={replyOn ? "MiB membacakan jawaban" : "MiB tidak bersuara"}
        className={`flex size-10 shrink-0 items-center justify-center rounded-xl hover:bg-line ${replyOn ? "text-accent-strong" : "text-muted"}`}
      >
        {replyOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
      </button>
      <button
        type="button"
        onClick={mic}
        disabled={disabled || state === "thinking"}
        aria-label={state === "listening" ? "Selesai bicara" : "Bicara ke MiB"}
        title={state === "listening" ? "Mendengarkan… klik bila selesai" : "Bicara ke MiB"}
        className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-40 ${
          state === "listening" ? "animate-pulse bg-red-500/80 text-white" : "text-muted hover:bg-line hover:text-foreground"
        }`}
      >
        {state === "thinking" ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
      </button>
    </>
  );
}
