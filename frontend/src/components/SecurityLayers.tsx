"use client";

import {
  Bot,
  Check,
  ChevronDown,
  Database,
  KeyRound,
  ServerCog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useId, useState } from "react";
import Reveal from "./Reveal";

/* Hanya klaim yang benar-benar sudah ada di kode backend MiB. */
const layers: {
  icon: LucideIcon;
  title: string;
  summary: string;
  points: string[];
}[] = [
  {
    icon: KeyRound,
    title: "Akun & sesi",
    summary: "Identitas Anda dijaga sejak masuk.",
    points: [
      "Kata sandi di-hash dengan Argon2, tidak pernah disimpan polos.",
      "Sesi disimpan di cookie HttpOnly yang tidak bisa dibaca skrip halaman, berlaku 1 hari.",
      "Pesan galat login sama untuk email tak terdaftar dan sandi salah, agar akun tidak bisa ditebak.",
    ],
  },
  {
    icon: Database,
    title: "Data Anda",
    summary: "Percakapan adalah milik Anda sendiri.",
    points: [
      "Percakapan hanya bisa dibuka pemiliknya; akses orang lain dijawab “tidak ditemukan”.",
      "Anda dapat menghapus percakapan kapan saja.",
      "Database memakai akun khusus MiB dengan hak terbatas, terpisah dari aplikasi lain.",
    ],
  },
  {
    icon: ServerCog,
    title: "Perlindungan server",
    summary: "Setiap permintaan diperiksa sebelum diproses.",
    points: [
      "Pembatasan laju: masuk 8×, daftar 5×, dan perintah 20× per menit untuk menahan penyalahgunaan.",
      "Header keamanan aktif, dan hanya situs MiB yang diizinkan memanggil API.",
      "Semua input divalidasi ketat; kolom yang tidak dikenal langsung ditolak.",
    ],
  },
  {
    icon: Bot,
    title: "Agen yang terkendali",
    summary: "MiB bekerja di dalam batas yang jelas.",
    points: [
      "Hanya alat yang terdaftar yang dapat dijalankan; perhitungan tanpa eval kode.",
      "Kunci layanan AI hanya ada di server MiB; aplikasi Anda hanya memegang kode lisensi.",
      "Satu perintah dibatasi 8 langkah, sehingga agen tidak berputar tanpa henti.",
    ],
  },
];

function Layer({
  icon: Icon,
  title,
  summary,
  points,
}: (typeof layers)[number]) {
  const id = useId();
  // Selalu mulai tertutup di semua ukuran layar; terbuka hanya setelah diketuk.
  const [open, setOpen] = useState(false);

  return (
    <article className="rounded-3xl border border-line bg-surface/60 backdrop-blur-sm transition-colors hover:border-accent/50">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-4 rounded-3xl p-5 text-left sm:p-7"
      >
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-strong ring-1 ring-accent/25 transition-transform duration-300 ${open ? "-rotate-6 scale-110" : ""}`}
        >
          <Icon className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-semibold">{title}</span>
          <span className="block text-sm text-muted">{summary}</span>
        </span>
        <ChevronDown
          className={`size-5 shrink-0 text-muted transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        id={id}
        inert={!open}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <ul className="space-y-3 px-5 pb-5 sm:px-7 sm:pb-7">
            {points.map((p) => (
              <li
                key={p}
                className="flex items-start gap-3 text-sm leading-relaxed"
              >
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent-strong">
                  <Check className="size-3" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

// Urutan di HP tetap 1-4; di layar lebar dibagi dua kolom independen
// (kiri: 1 & 3, kanan: 2 & 4) agar membuka satu kartu tidak meninggalkan celah di kolom sebelah.
const mobileOrder = ["order-1", "order-2", "order-3", "order-4"];
const columns = [
  [0, 2],
  [1, 3],
];

export default function SecurityLayers() {
  return (
    <div className="mt-10 flex flex-col gap-3 sm:mt-14 sm:gap-5 md:grid md:grid-cols-2 md:items-start">
      {columns.map((col, c) => (
        <div key={c} className="contents md:flex md:flex-col md:gap-5">
          {col.map((i) => (
            <Reveal
              key={layers[i].title}
              delay={c * 0.1}
              className={`${mobileOrder[i]} md:order-none`}
            >
              <Layer {...layers[i]} />
            </Reveal>
          ))}
        </div>
      ))}
    </div>
  );
}
