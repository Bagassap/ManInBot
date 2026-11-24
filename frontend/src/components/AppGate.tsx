"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { api, API_URL, type User } from "@/lib/api";
import AccountPanel, { type AccountStatus } from "./AccountPanel";
import BrainPanel from "./BrainPanel";
import ChatApp from "./ChatApp";

const notifyShell = () => window.dispatchEvent(new Event("mib-account"));

export default function AppGate() {
  const [me, setMe] = useState<User | null>(null);
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [brainReady, setBrainReady] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    setStatus(await api<AccountStatus>("/settings"));
    notifyShell();
  }, []);

  const brainInstalled = useCallback(() => {
    setBrainReady(true);
    notifyShell();
  }, []);

  useEffect(() => {
    if (API_URL !== "") return;
    Promise.all([api<User>("/auth/me"), api<AccountStatus>("/settings"), api<{ ready: boolean }>("/brain")])
      .then(([u, s, b]) => {
        setMe(u);
        setStatus(s);
        setBrainReady(b.ready);
      })
      .catch(() => setFailed(true));
  }, []);

  if (API_URL !== "" || failed || (brainReady && status?.accountReady)) return <ChatApp />;
  if (!status || !me || brainReady === null) {
    return <div className="flex min-h-dvh items-center justify-center text-sm text-muted">Memuat…</div>;
  }
  const isAdmin = me.role === "ADMIN";
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4 py-8">
      <div className="flex items-center gap-2.5">
        <Image src="/asset/logo-mark-v2.png" alt="" width={32} height={36} className="shrink-0" />
        <span className="font-display text-xl font-semibold tracking-tight">MiB</span>
      </div>
      {brainReady ? (
        <div className="w-full max-w-md">
          <AccountPanel key={status.loggedIn ? "masuk" : "keluar"} isAdmin={isAdmin} status={status} reload={reload} />
        </div>
      ) : (
        <div className="w-full max-w-xl">
          <h1 className="mb-1 text-center text-xl font-semibold">Pilih model MiB</h1>
          <p className="mb-4 text-center text-sm text-muted">Tentukan model sesuai komputer Anda sebelum mulai. Bisa diganti nanti di Pengaturan.</p>
          <BrainPanel isAdmin={isAdmin} onReady={brainInstalled} />
        </div>
      )}
    </div>
  );
}
