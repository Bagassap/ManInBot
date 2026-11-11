"use client";

import Link from "next/link";
import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function QuickStart() {
  const origin = API || (typeof window !== "undefined" ? window.location.origin : "");
  const tabs = {
    "Satu baris": [
      "# Windows (PowerShell)",
      `irm ${origin}/download/install.ps1 | iex`,
      "",
      "# lalu buka MiB dari Start Menu",
    ].join("\n"),
    Aplikasi: [
      "1. Unduh MiB-Setup.exe dari halaman Unduh",
      "2. Jalankan, klik Next lalu Install",
      "3. Buka MiB, buat akun di komputer",
      "4. Pengaturan -> Akun MiB -> daftar dengan email",
      "   (gratis 3 perintah per hari)",
    ].join("\n"),
  } as const;
  type Tab = keyof typeof tabs;
  const [tab, setTab] = useState<Tab>("Satu baris");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tabs[tab]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard tidak tersedia */
    }
  };

  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex items-center gap-1 border-b border-line px-3 py-2 text-sm">
        {(Object.keys(tabs) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 transition-colors ${tab === t ? "bg-background text-foreground" : "text-muted hover:text-foreground"}`}
          >
            {t}
          </button>
        ))}
        <span className="ml-auto rounded-md border border-line px-2 py-0.5 text-xs text-muted">β Beta</span>
      </div>
      <div className="relative">
        <pre className="overflow-x-auto p-5 font-mono text-sm leading-relaxed text-accent-strong">{tabs[tab]}</pre>
        <button
          onClick={copy}
          className="absolute right-3 top-3 rounded-lg border border-line bg-background px-2.5 py-1 text-xs text-muted transition-colors hover:text-foreground"
        >
          {copied ? "Tersalin" : "Salin"}
        </button>
      </div>
      <div className="border-t border-line px-5 py-3 text-sm text-muted">
        Butuh pemasang langsung?{" "}
        <Link href="/unduh" className="text-accent-strong hover:underline">
          Lihat semua opsi unduhan
        </Link>
      </div>
    </div>
  );
}
