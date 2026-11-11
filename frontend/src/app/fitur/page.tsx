import type { Metadata } from "next";
import Link from "next/link";
import { FileText, FolderLock, Laptop, MousePointerClick, ScrollText, Terminal, type LucideIcon } from "lucide-react";
import ApprovalDemo from "@/components/ApprovalDemo";
import Reveal from "@/components/Reveal";
import SiteShell from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Fitur — MiB",
  description: "Yang bisa dikerjakan MiB di komputer Anda: dokumen, berkas, perintah, dan mengoperasikan aplikasi.",
};

interface Feature {
  icon: LucideIcon;
  title: string;
  text: string;
  points: string[];
  status: "Aktif" | "Terbatas";
  doc: string;
}

const FEATURES: Feature[] = [
  {
    icon: Laptop,
    title: "Berjalan di komputer Anda",
    text: "MiB adalah aplikasi desktop, bukan layanan web. Berkas dan pengaturan tetap di komputer Anda.",
    points: ["Pasang sekali, langsung pakai", "Aplikasi tidak bisa diakses dari jaringan; hanya Anda yang memakainya", "Berkas dan data kerja tetap di komputer Anda"],
    status: "Aktif",
    doc: "/docs/ikhtisar",
  },
  {
    icon: FolderLock,
    title: "Hanya folder yang Anda izinkan",
    text: "Anda memilih folder yang boleh diakses, dengan mode baca saja atau baca dan tulis. Di luar itu MiB tidak bisa menyentuh apa pun.",
    points: ["Jalur ../ dan pintasan keluar folder ditolak", "Mencabut izin kapan saja", "Perubahan folder tercatat di log audit"],
    status: "Aktif",
    doc: "/docs/konfigurasi",
  },
  {
    icon: FileText,
    title: "Dokumen Word, PowerPoint, Excel, PDF",
    text: "Baca dokumen yang ada, atau minta MiB menyusun yang baru: surat, laporan, tabel, dan presentasi lengkap dengan catatan pembicara.",
    points: ["Membaca .docx, .pptx, dan PDF", "Membuat .docx (judul, paragraf, butir, tabel) dan .pptx", "Mengganti teks di dokumen yang ada tanpa merusak format", "Membuka hasilnya di Word atau PowerPoint Anda"],
    status: "Aktif",
    doc: "/docs/ikhtisar",
  },
  {
    icon: MousePointerClick,
    title: "Mengoperasikan aplikasi kantor di layar",
    text: "MiB melihat layar, menggerakkan mouse, dan mengetik sendiri di Word, Excel, PowerPoint, Outlook, atau aplikasi kantor lain, langsung di depan Anda.",
    points: ["Hanya setelah Anda memberi izin per sesi", "Hentikan seketika dengan Esc atau menggerakkan mouse", "Tidak mengetik kata sandi, kartu, atau OTP", "Tersedia di Windows, monitor utama"],
    status: "Aktif",
    doc: "/docs/konfigurasi",
  },
  {
    icon: Terminal,
    title: "Perintah PowerShell",
    text: "Untuk tugas teknis seperti merapikan ratusan berkas. Anda melihat perintah persisnya sebelum menekan Izinkan.",
    points: ["Dibatasi ke folder izin tulis", "Batas waktu dan batas keluaran", "Rahasia MiB tidak diwariskan ke perintah"],
    status: "Aktif",
    doc: "/docs/konfigurasi",
  },
  {
    icon: ScrollText,
    title: "Tim dan jejak audit",
    text: "Undang rekan dengan peran masing-masing, dan lihat siapa meminta apa, kapan, dan apa yang akhirnya dilakukan agen.",
    points: ["Peran Pemilik, Admin, Anggota", "Log audit yang bisa disaring", "Setiap izin tercatat: disetujui, ditolak, atau kedaluwarsa"],
    status: "Aktif",
    doc: "/docs/konfigurasi",
  },
];

const ROADMAP: [string, string][] = [
  ["Skills dan plugin", "Kemampuan tambahan yang bisa dipasang sesuai kebutuhan."],
  ["Memori jangka panjang", "MiB mengingat preferensi dan konteks pekerjaan Anda."],
  ["Jadwal otomatis", "Tugas berkala yang berjalan sendiri, dengan batas yang Anda tentukan."],
  ["WhatsApp dan Telegram", "Beri tugas dari aplikasi chat yang sudah Anda pakai."],
  ["Edit dokumen lanjutan", "Menambah paragraf, slide, dan gambar ke dokumen yang sudah ada, serta OCR untuk PDF hasil pindai."],
  ["macOS dan Linux", "Versi untuk sistem operasi lain."],
];

export default function FiturPage() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-4xl px-5 pb-6 pt-14 text-center sm:pt-20">
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">Yang bisa dikerjakan MiB</h1>
        <p className="mx-auto mt-4 hidden max-w-2xl text-pretty text-lg text-muted sm:block">
          Satu agen khusus pekerjaan kantor yang memakai komputer Anda seperti staf di depan layar yang sama, dengan
          Anda tetap memegang kendali.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/unduh" className="fx-btn rounded-xl bg-accent px-6 py-3 font-medium text-[#0d1417] transition-colors hover:bg-accent-strong">
            Unduh untuk Windows
          </Link>
          <Link href="/docs" className="rounded-xl border border-line px-6 py-3 font-medium transition-colors hover:bg-surface">
            Baca dokumentasi
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-4 md:grid-cols-2">
          {FEATURES.map((f) => (
            <Reveal key={f.title}>
              <article className="flex h-full flex-col rounded-2xl border border-line bg-surface p-6">
                <div className="flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-accent/12 text-accent-strong">
                    <f.icon className="size-5" />
                  </span>
                  <span className="rounded-md border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent-strong">{f.status}</span>
                </div>
                <h2 className="mt-5 text-xl font-semibold">{f.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted sm:line-clamp-none">{f.text}</p>
                <ul className="mt-4 hidden space-y-1.5 text-sm text-muted sm:block">
                  {f.points.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-accent-strong" />
                      {p}
                    </li>
                  ))}
                </ul>
                <Link href={f.doc} className="mt-5 pt-1 text-sm text-accent-strong hover:underline">
                  Selengkapnya di dokumentasi →
                </Link>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-14 md:grid-cols-2">
        <Reveal>
          <h2 className="text-3xl font-semibold tracking-tight">Anda yang memutuskan</h2>
          <p className="mt-3 hidden text-muted sm:block">
            Sebelum MiB menulis berkas, membuat dokumen, menjalankan perintah, atau mengambil alih layar, Anda melihat
            persis apa yang akan dilakukan dan memilih Izinkan atau Tolak. Tidak dijawab dalam 5 menit, permintaan
            otomatis ditolak.
          </p>
        </Reveal>
        <Reveal>
          <ApprovalDemo />
          <p className="mt-2 text-center text-xs text-muted">Contoh tampilan kartu izin</p>
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20 pt-6">
        <Reveal>
          <h2 className="text-3xl font-semibold tracking-tight">Sedang disiapkan</h2>
          <p className="mt-2 hidden text-muted sm:block">Belum tersedia hari ini, dan kami tidak akan berpura-pura sebaliknya.</p>
        </Reveal>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROADMAP.map(([t, d]) => (
            <div key={t} className="rounded-xl border border-dashed border-line px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{t}</span>
                <span className="rounded-md border border-line px-2 py-0.5 text-xs text-muted">Segera</span>
              </div>
              <p className="mt-1 hidden text-sm text-muted sm:block">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
