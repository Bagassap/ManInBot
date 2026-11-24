"use client";

import Link from "next/link";
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
      .catch(() => ({ available: false }))
      .then((d: Info) => setInfo(d));
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
    }
  };

  const ready = info?.available;
  return (
    <div className="mx-auto max-w-2xl px-5 py-14 sm:py-20">
      <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
        Pasang MiB di komputer Anda
      </h1>
      <p className="mt-3 text-muted">
        <span className="sm:hidden">Gratis. Pasang sekali, lalu bekerja offline.</span>
        <span className="hidden sm:inline">
          MiB gratis dan berjalan offline di komputer Anda: pekerjaan tidak dikirim ke internet, dan setiap
          tindakan yang mengubah berkas atau menjalankan perintah menunggu persetujuan Anda.
        </span>
      </p>

      <section className="mt-10 rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-medium">Windows 10 / 11</h2>
        {info === null ? (
          <p className="mt-3 text-sm text-muted">Memeriksa versi terbaru…</p>
        ) : ready ? (
          <>
            <p className="mt-3 text-sm text-muted">
              Satu pemasang untuk semua komputer. Model dipilih di aplikasi setelah MiB terpasang.{" "}
              <Link href="/docs/model" className="text-accent-strong underline underline-offset-2 hover:no-underline">
                Lihat perbedaan 3 model
              </Link>
            </p>
            <a
              href={`${API}/download/windows`}
              className="fx-btn mt-4 inline-block rounded-xl bg-accent px-6 py-3 font-medium text-[#0d1417] transition-colors hover:bg-accent-strong"
            >
              Unduh MiB {info.version}
            </a>
            <p className="mt-2 text-sm text-muted">
              {info.size ? `${Math.round(info.size / 1024 / 1024)} MB` : ""} · pemasang .exe · model (3 sampai 7 GB) diunduh setelah Anda memilihnya
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

        <p className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-dashed border-line px-3 py-2.5 text-sm">
          <span>MiB Online</span>
          <span className="text-muted">Akan tersedia</span>
        </p>

        {ready && info.sha256 && (
          <p className="mt-5 break-all text-xs text-muted">SHA-256: {info.sha256}</p>
        )}
      </section>

      <section className="mt-8 space-y-3 text-sm text-muted">
        <h2 className="text-base font-medium text-foreground">Setelah terpasang</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Buka MiB, pilih model Ringan, Sedang, atau Kuat, lalu tunggu unduhannya selesai.</li>
          <li>Daftar akun dengan email dan kata sandi, lalu isi data diri.</li>
          <li>Di Pengaturan → Folder lokal, pilih folder yang boleh diakses MiB.</li>
          <li>Kembali ke chat dan beri tugas pertama.</li>
        </ol>
        <p>
          Bila muncul layar biru “Windows protected your PC” (SmartScreen), itu wajar karena pemasang belum
          ditandatangani secara digital. Klik “Info lainnya”, lalu tombol “Tetap jalankan”. Panduan
          lengkap dengan gambaran tiap langkah ada di{" "}
          <Link href="/docs/instalasi" className="text-accent-strong underline underline-offset-2 hover:no-underline">
            dokumentasi instalasi
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
