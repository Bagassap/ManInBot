"use client";

import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Loader2,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type User } from "@/lib/api";

export interface AppSettings {
  agentReady: boolean;
  keyHint: string | null;
  canSaveKey: boolean;
  model: string;
}

const messageOf = (e: unknown) =>
  e instanceof Error ? e.message : "Terjadi kesalahan";

export default function SettingsApp() {
  const router = useRouter();
  const [me, setMe] = useState<User | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setSettings(await api<AppSettings>("/settings"));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setMe(await api<User>("/auth/me"));
        await load();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) router.replace("/masuk");
        else setError(messageOf(e));
      }
    })();
  }, [router, load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim() || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await api<{ verified: boolean }>("/settings/anthropic-key", {
        method: "PUT",
        body: JSON.stringify({ key: key.trim() }),
      });
      setKey("");
      setNotice(
        r.verified
          ? "Kunci tersimpan dan terverifikasi. MiB siap dipakai."
          : "Kunci tersimpan, tetapi belum bisa diverifikasi (periksa koneksi internet). Kunci akan terbukti saat dipakai.",
      );
      await load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    if (
      !confirm(
        "Hapus kunci API dari komputer ini? MiB berhenti bekerja sampai kunci baru dimasukkan.",
      )
    )
      return;
    setError("");
    setNotice("");
    try {
      await api("/settings/anthropic-key", { method: "DELETE" });
      await load();
    } catch (err) {
      setError(messageOf(err));
    }
  }

  const isAdmin = me?.role === "ADMIN";

  return (
    <div className="mx-auto min-h-dvh w-full max-w-2xl px-4 py-5 sm:px-6">
      <header className="flex items-center gap-3 pb-5">
        <Link
          href="/app"
          aria-label="Kembali"
          className="flex size-10 items-center justify-center rounded-xl border border-line transition-colors hover:bg-white/5"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="font-display text-lg font-semibold">Pengaturan</h1>
      </header>

      {(error || notice) && (
        <p
          role={error ? "alert" : "status"}
          className={`mb-4 rounded-xl border px-4 py-2.5 text-sm ${error ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-accent/30 bg-accent/10 text-accent-strong"}`}
        >
          {error || notice}
        </p>
      )}

      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center gap-2.5">
          <KeyRound className="size-5 text-accent-strong" />
          <h2 className="font-medium">Kunci API Claude</h2>
          {settings && (
            <span
              className={`ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${settings.agentReady ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-200"}`}
            >
              {settings.agentReady ? (
                <>
                  <CheckCircle2 className="size-3.5" /> Aktif {settings.keyHint}
                </>
              ) : (
                "Belum diatur"
              )}
            </span>
          )}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          MiB memakai Claude sebagai otaknya, dengan kunci API milik Anda
          sendiri. Kunci disimpan hanya di komputer ini (di folder data
          aplikasi, bukan di database) dan dikirim hanya ke Anthropic. Buat
          kunci di console.anthropic.com. Biaya pemakaian ditagih Anthropic ke
          akun Anda.
        </p>

        {!settings ? (
          <p className="mt-4 animate-pulse text-sm text-muted">Memuat…</p>
        ) : !isAdmin ? (
          <p className="mt-4 text-sm text-muted">
            Hanya admin komputer ini yang bisa mengubah kunci.
          </p>
        ) : !settings.canSaveKey ? (
          <p className="mt-4 text-sm text-muted">
            Penyimpanan kunci lewat layar ini hanya tersedia pada aplikasi
            terpasang. Pada mode pengembangan, isi ANTHROPIC_API_KEY di
            backend/.env.
          </p>
        ) : (
          <form
            onSubmit={save}
            className="mt-4 flex flex-col gap-2 sm:flex-row"
          >
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="sk-ant-…"
              aria-label="Kunci API Claude"
              className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-transparent px-3 font-mono text-sm outline-none focus:border-accent"
            />
            <button
              disabled={busy || !key.trim()}
              className="flex h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-[#0d1417] hover:bg-accent-strong disabled:opacity-50"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {settings.agentReady ? "Ganti kunci" : "Simpan kunci"}
            </button>
            {settings.agentReady && (
              <button
                type="button"
                onClick={() => void clear()}
                aria-label="Hapus kunci"
                className="flex h-10 items-center justify-center gap-2 rounded-xl border border-line px-3 text-sm text-muted transition-colors hover:text-red-300"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </form>
        )}
        {settings && (
          <p className="mt-3 text-xs text-muted">Model: {settings.model}</p>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-line bg-surface p-5 text-sm leading-relaxed text-muted">
        <h2 className="mb-2 font-medium text-foreground">
          Akses ke komputer ini
        </h2>
        MiB hanya menyentuh berkas di folder yang Anda izinkan, dan selalu
        meminta persetujuan sebelum menulis berkas atau menjalankan perintah.{" "}
        <Link href="/app/workspace" className="text-accent-strong underline">
          Atur folder yang diizinkan
        </Link>
        .
      </section>
    </div>
  );
}
