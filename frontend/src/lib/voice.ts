"use client";

import { API_URL } from "@/lib/api";

export interface VoiceStatus {
  sttReady: boolean;
  ttsReady: boolean;
  voice: string | null;
  job: { running: boolean; pct: number | null; message: string; error: string | null };
}

const RATE = 16000;
const MAX_SECONDS = 60;
const SILENCE_MS = 1500;
const SPEECH_RMS = 0.015;
/** Tanpa ucapan sama sekali selama ini, rekaman dibatalkan. */
const NO_SPEECH_MS = 8000;

function toWav(chunks: Float32Array[]) {
  const samples = chunks.reduce((n, c) => n + c.length, 0);
  const buf = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(buf);
  const tag = (at: number, s: string) => [...s].forEach((ch, i) => v.setUint8(at + i, ch.charCodeAt(0)));
  tag(0, "RIFF");
  v.setUint32(4, 36 + samples * 2, true);
  tag(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  tag(36, "data");
  v.setUint32(40, samples * 2, true);
  let at = 44;
  for (const c of chunks)
    for (const x of c) {
      const s = Math.max(-1, Math.min(1, x));
      v.setInt16(at, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      at += 2;
    }
  return new Blob([buf], { type: "audio/wav" });
}

export interface Recording {
  /** Selesai merekam; null bila tidak ada ucapan. */
  result: Promise<Blob | null>;
  stop: () => void;
  cancel: () => void;
}

/** Merekam dari mikrofon dan berhenti sendiri setelah pengguna diam. */
export async function record(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const ctx = new AudioContext({ sampleRate: RATE });
  const source = ctx.createMediaStreamSource(stream);
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  const started = performance.now();
  let lastVoice = 0;
  let finish: (b: Blob | null) => void = () => undefined;
  const result = new Promise<Blob | null>((r) => (finish = r));
  let closed = false;

  const close = (keep: boolean) => {
    if (closed) return;
    closed = true;
    node.disconnect();
    source.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
    finish(keep && lastVoice > 0 ? toWav(chunks) : null);
  };

  node.onaudioprocess = (e) => {
    const data = new Float32Array(e.inputBuffer.getChannelData(0));
    chunks.push(data);
    const rms = Math.sqrt(data.reduce((n, x) => n + x * x, 0) / data.length);
    const now = performance.now();
    if (rms > SPEECH_RMS) lastVoice = now;
    if (lastVoice && now - lastVoice > SILENCE_MS) close(true);
    else if (!lastVoice && now - started > NO_SPEECH_MS) close(false);
    else if (now - started > MAX_SECONDS * 1000) close(true);
  };
  source.connect(node);
  node.connect(ctx.destination);
  return { result, stop: () => close(true), cancel: () => close(false) };
}

export async function transcribe(wav: Blob) {
  const r = await fetch(`${API_URL}/voice/transcribe`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "audio/wav" },
    body: wav,
  });
  if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { message?: string } | null)?.message || "Suara tidak bisa diproses.");
  return ((await r.json()) as { text: string }).text;
}

let current: HTMLAudioElement | null = null;

export function stopSpeaking() {
  if (!current) return;
  current.pause();
  URL.revokeObjectURL(current.src);
  current = null;
}

/** Membacakan teks; selesai saat audio berhenti. */
export async function speak(text: string) {
  stopSpeaking();
  const r = await fetch(`${API_URL}/voice/speak`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: text.slice(0, 8000) }),
  });
  if (!r.ok) throw new Error("Gagal membacakan jawaban.");
  const audio = new Audio(URL.createObjectURL(await r.blob()));
  current = audio;
  await new Promise<void>((resolve) => {
    audio.onended = audio.onerror = audio.onpause = () => resolve();
    audio.play().catch(() => resolve());
  });
  if (current === audio) stopSpeaking();
}
