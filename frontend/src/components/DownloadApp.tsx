"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Tier = "ringan" | "sedang" | "kuat";
const TIERS: { id: Tier; label: string; cpu: string; ram: string; size: string }[] = [
  { id: "ringan", label: "Ringan", cpu: "Core i3 / Ryzen 3", ram: "RAM 4–8 GB", size: "±3 GB" },
  { id: "sedang", label: "Sedang", cpu: "Core i5 / Ryzen 5", ram: "RAM 8 GB ke atas", size: "±4 GB" },
  { id: "kuat", label: "Kuat", cpu: "Core i7 / Ryzen 7", ram: "RAM 16 GB ke atas", size: "±7 GB" },
];

/** Perkiraan dari browser (jumlah thread dan RAM, yang dibatasi browser); pemasang memeriksa lagi dengan data sebenarnya. */
function guessTier(): Tier {
  const threads = navigator.hardwareConcurrency || 4;
  const ram = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (threads <= 4 || (ram !== undefined && ram < 8)) return "ringan";
  return threads >= 16 ? "kuat" : "sedang";
}

interface Info {
  available: boolean;
  version?: string;
  size?: number;
  sha256?: string;
}

export default function DownloadApp() {
  const [info, setInfo] = useState<Info | null>(null);
  const [copied, setCopied] = useState(false);
  const [tier, setTier] = useState<Tier>("sedang");
  const [suggested, setSuggested] = useState<Tier | null>(null);
  const origin = API || (typeof window !== "undefined" ? window.location.origin : "");
  const command = `irm ${origin}/download/install.ps1 | iex`;

  useEffect(() => {
    fetch(`${API}/download/info`)
      .then((r) => (r.ok ? r.json() : { available: false }))
      .catch(() => ({ available: false }))
      .then((d: Info) => {
        const g = guessTier();
        setInfo(d);
        const asked = new URLSearchParams(window.location.search).get("model");
        setSuggested(g);
        setTier(TIERS.some((t) => t.id === asked) ? (asked as Tier) : g);
      });
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
            <p className="mt-3 text-sm text-muted">Pilih sesuai prosesor Anda. Pemasang akan memeriksa PC Anda lagi.</p>
            <div className="mt-3 space-y-2" role="radiogroup" aria-label="Pilih model">
              {TIERS.map((t) => (
                <label key={t.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${tier === t.id ? "border-accent bg-accent/10" : "border-line hover:bg-background"}`}>
                  <input type="radio" name="tier" checked={tier === t.id} onChange={() => setTier(t.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{t.label}</span>
                    <span className="text-muted"> · {t.cpu} · {t.ram}</span>
                    {suggested === t.id && <span className="ml-2 text-xs text-accent-strong">Disarankan</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{t.size}</span>
                </label>
              ))}
            </div>
            <a
              href={`${API}/download/windows/${tier}`}
              className="fx-btn mt-4 inline-block rounded-xl bg-accent px-6 py-3 font-medium text-[#0d1417] transition-colors hover:bg-accent-strong"
            >
              Unduh MiB {info.version}
            </a>
            <p className="mt-2 text-sm text-muted">
              {info.size ? `${Math.round(info.size / 1024 / 1024)} MB` : ""} · pemasang .exe · mesin AI dan model diunduh saat pemasangan
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
          <li>Saat memasang, biarkan jendela kemajuan selesai mengunduh otak MiB (butuh internet sekali ini saja).</li>
          <li>Buka MiB, daftar akun dengan email dan kata sandi, lalu isi data diri.</li>
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
