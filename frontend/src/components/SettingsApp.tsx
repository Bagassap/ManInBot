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
  license: { quotaTokens: number; usedTokens: number; expiresAt: string | null } | null;
  licenseProblem: string | null;
}

const fmt = (n: number) => n.toLocaleString("id-ID");

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
      const r = await api<{ verified: boolean }>("/settings/license", {
        method: "PUT",
        body: JSON.stringify({ code: key.trim() }),
      });
      setKey("");
      setNotice(
        r.verified
          ? "Kode lisensi aktif. MiB siap dipakai."
          : "Kode tersimpan, tetapi belum bisa diperiksa (periksa koneksi internet). Kode akan terbukti saat dipakai.",
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
        "Hapus kode lisensi dari komputer ini? MiB berhenti bekerja sampai kode baru dimasukkan.",
      )
    )
      return;
    setError("");
    setNotice("");
    try {
      await api("/settings/license", { method: "DELETE" });
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
          <h2 className="font-medium">Kode lisensi</h2>
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
          Masukkan kode lisensi MiB Anda untuk mengaktifkan agen. Kode
          disimpan hanya di komputer ini. Pemakaian dihitung dari kuota pada
          kode Anda; tidak ada kunci atau biaya lain yang perlu Anda atur.
        </p>

        {settings?.licenseProblem && (
          <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
            {settings.licenseProblem}
          </p>
        )}
        {settings?.license && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted">
              <span>
                Kuota terpakai {fmt(settings.license.usedTokens)} dari {fmt(settings.license.quotaTokens)}
              </span>
              {settings.license.expiresAt && <span>Berlaku s.d. {new Date(settings.license.expiresAt).toLocaleDateString("id-ID")}</span>}
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.min(100, (settings.license.usedTokens / Math.max(1, settings.license.quotaTokens)) * 100)}%` }}
              />
            </div>
          </div>
        )}
        {!settings ? (
          <p className="mt-4 animate-pulse text-sm text-muted">Memuat…</p>
        ) : !isAdmin ? (
          <p className="mt-4 text-sm text-muted">
            Hanya admin komputer ini yang bisa mengubah kode lisensi.
          </p>
        ) : !settings.canSaveKey ? (
          <p className="mt-4 text-sm text-muted">
            Penyimpanan kode lewat layar ini hanya tersedia pada aplikasi
            terpasang.
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
              placeholder="MIB-XXXXXX-XXXXXX-XXXXXX"
              aria-label="Kode lisensi"
              className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-transparent px-3 font-mono text-sm outline-none focus:border-accent"
            />
            <button
              disabled={busy || !key.trim()}
              className="flex h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-[#0d1417] hover:bg-accent-strong disabled:opacity-50"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {settings.agentReady ? "Ganti kode" : "Aktifkan"}
            </button>
            {settings.agentReady && (
              <button
                type="button"
                onClick={() => void clear()}
                aria-label="Hapus kode"
                className="flex h-10 items-center justify-center gap-2 rounded-xl border border-line px-3 text-sm text-muted transition-colors hover:text-red-300"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </form>
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
