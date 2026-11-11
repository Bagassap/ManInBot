"use client";

import {
  Check,
  ChevronDown,
  FolderLock,
  MousePointerClick,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useId, useState } from "react";
import Reveal from "./Reveal";

/* Hanya klaim yang benar-benar berlaku pada aplikasi MiB yang dipasang. */
const layers: {
  icon: LucideIcon;
  title: string;
  summary: string;
  points: string[];
}[] = [
  {
    icon: FolderLock,
    title: "Di komputer Anda",
    summary: "Berkas Anda tidak ke mana-mana.",
    points: [
      "Berkas, riwayat percakapan, dan pengaturan disimpan di komputer Anda, bukan di server MiB.",
      "MiB hanya bisa menyentuh folder yang Anda daftarkan, dengan mode baca saja atau baca dan tulis.",
      "Jalur dan pintasan yang mengarah keluar dari folder izin ditolak.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Persetujuan Anda",
    summary: "Tidak ada tindakan penting tanpa izin.",
    points: [
      "Menulis berkas, membuat dokumen, menjalankan perintah, dan mengendalikan layar selalu menunggu Izinkan dari Anda.",
      "Permintaan yang tidak dijawab dalam 5 menit otomatis ditolak.",
      "Setiap tindakan tercatat di log audit yang bisa Anda lihat.",
    ],
  },
  {
    icon: MousePointerClick,
    title: "Khusus aplikasi kantor",
    summary: "Kendali layar dibatasi ke Microsoft Office.",
    points: [
      "MiB hanya menggerakkan mouse dan keyboard di Word, Excel, PowerPoint, Outlook, OneNote, dan Publisher.",
      "Klik atau ketikan ke jendela lain, seperti browser atau pengaturan Windows, diblokir.",
      "Hentikan seketika dengan menekan Esc atau menggerakkan mouse.",
    ],
  },
  {
    icon: UserRound,
    title: "Akun dan privasi",
    summary: "Yang disimpan di server dibatasi seperlunya.",
    points: [
      "Server MiB menyimpan email akun, kata sandi terenkripsi, jumlah pemakaian, dan riwayat pembayaran.",
      "Isi percakapan, berkas, dan tangkapan layar tidak disimpan di server MiB.",
      "Batas perintah harian per akun mencegah penyalahgunaan.",
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
