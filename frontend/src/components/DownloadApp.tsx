"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Info {
  available: boolean;
  version?: string;
  size?: number;
  sha256?: string;
}

export default function DownloadApp() {
  const [info, setInfo] = useState<Info | null>(null);
  const [copied, setCopied] = useState(false);
  const origin = API || (typeof window !== "undefined" ? window.location.origin : "");
  const command = `irm ${origin}/download/install.ps1 | iex`;

  useEffect(() => {
    fetch(`${API}/download/info`)
      .then((r) => (r.ok ? r.json() : { available: false }))
      .then(setInfo)
      .catch(() => setInfo({ available: false }));
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard tidak tersedia */
    }
  };

  const ready = info?.available;
  return (
    <div className="mx-auto max-w-2xl px-5 py-14 sm:py-20">
      <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
        Pasang MiB di komputer Anda
      </h1>
      <p className="mt-3 text-muted">
        MiB berjalan di komputer Anda sendiri: data dan folder tetap di sana, dan setiap
        tindakan yang mengubah berkas atau menjalankan perintah menunggu persetujuan Anda.
        Anda hanya perlu kode lisensi MiB.
      </p>

      <section className="mt-10 rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-medium">Windows 10 / 11</h2>
        {info === null ? (
          <p className="mt-3 text-sm text-muted">Memeriksa versi terbaru…</p>
        ) : ready ? (
          <>
            <a
              href={`${API}/download/windows`}
              className="fx-btn mt-4 inline-block rounded-xl bg-accent px-6 py-3 font-medium text-[#0d1417] transition-colors hover:bg-accent-strong"
            >
              Unduh MiB {info.version}
            </a>
            <p className="mt-2 text-sm text-muted">
              {info.size ? `${Math.round(info.size / 1024 / 1024)} MB` : ""} · pemasang .exe
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">Pemasang belum tersedia di server ini.</p>
        )}

        <div className="mt-6 border-t border-line pt-5">
          <p className="text-sm text-muted">Atau satu baris di PowerShell:</p>
          <div className="mt-2 flex items-stretch gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-line bg-background px-3 py-2 text-sm">
              {command}
            </code>
            <button
              onClick={copy}
              className="shrink-0 rounded-lg border border-line px-3 text-sm transition-colors hover:bg-background"
            >
              {copied ? "Tersalin" : "Salin"}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Skrip mengunduh pemasang, memeriksa SHA-256-nya, lalu menjalankannya.
          </p>
        </div>

        {ready && info.sha256 && (
          <p className="mt-5 break-all text-xs text-muted">SHA-256: {info.sha256}</p>
        )}
      </section>

      <section className="mt-8 space-y-3 text-sm text-muted">
        <h2 className="text-base font-medium text-foreground">Setelah terpasang</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Buka MiB, lalu daftar. Akun pertama otomatis menjadi admin.</li>
          <li>Buka Pengaturan dan masukkan kode lisensi Anda.</li>
          <li>Di Pengaturan → Folder lokal, pilih folder yang boleh diakses MiB.</li>
        </ol>
        <p>
          Windows SmartScreen bisa memperingatkan karena pemasang belum ditandatangani. Pilih
          “Info lainnya” → “Tetap jalankan” bila Anda memercayai sumbernya.
        </p>
      </section>
    </div>
  );
}
