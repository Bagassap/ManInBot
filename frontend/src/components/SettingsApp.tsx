"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type User } from "@/lib/api";
import AccountPanel, { type AccountView, type PlanView } from "./AccountPanel";

export interface AppSettings {
  agentReady: boolean;
  canSaveKey: boolean;
  loggedIn: boolean;
  account: AccountView | null;
  accountProblem: string | null;
  plan: PlanView | null;
}

const messageOf = (e: unknown) =>
  e instanceof Error ? e.message : "Terjadi kesalahan";

export default function SettingsApp() {
  const router = useRouter();
  const [me, setMe] = useState<User | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState("");

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

      {error && (
        <p
          role="alert"
          className={`mb-4 rounded-xl border px-4 py-2.5 text-sm ${error ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-accent/30 bg-accent/10 text-accent-strong"}`}
        >
          {error}
        </p>
      )}

      {settings && (
        <AccountPanel
          isAdmin={isAdmin}
          loggedIn={settings.loggedIn}
          account={settings.account}
          problem={settings.accountProblem}
          plan={settings.plan}
          canSave={settings.canSaveKey}
          reload={load}
        />
      )}
      {!settings && !error && <p className="animate-pulse text-sm text-muted">Memuat…</p>}

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
