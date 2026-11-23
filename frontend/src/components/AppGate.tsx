"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { api, API_URL, type User } from "@/lib/api";
import AccountPanel, { type AccountStatus } from "./AccountPanel";
import ChatApp from "./ChatApp";

/** Aplikasi desktop: chat baru terbuka setelah pengguna masuk ke akun MiB dan melengkapi data diri. */
export default function AppGate() {
  const [me, setMe] = useState<User | null>(null);
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [open, setOpen] = useState(API_URL !== "");

  const reload = useCallback(async () => {
    const s = await api<AccountStatus>("/settings");
    setStatus(s);
    if (s.accountReady) setOpen(true);
  }, []);

  useEffect(() => {
    if (API_URL !== "") return;
    Promise.all([api<User>("/auth/me"), api<AccountStatus>("/settings")])
      .then(([u, s]) => {
        setMe(u);
        setStatus(s);
        if (s.accountReady) setOpen(true);
      })
      // Sesi habis ditangani ChatApp (masuk ulang otomatis); server tetap menolak perintah tanpa akun.
      .catch(() => setOpen(true));
  }, []);

  if (open) return <ChatApp />;
  if (!status || !me) return <div className="flex min-h-dvh items-center justify-center text-sm text-muted">Memuat…</div>;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4 py-8">
      <div className="flex items-center gap-2.5">
        <Image src="/asset/logo-mark-v2.png" alt="" width={32} height={36} className="shrink-0" />
        <span className="font-display text-xl font-semibold tracking-tight">MiB</span>
      </div>
      <div className="w-full max-w-md">
        <AccountPanel key={status.loggedIn ? "masuk" : "keluar"} isAdmin={me.role === "ADMIN"} status={status} reload={reload} />
      </div>
    </div>
  );
}
