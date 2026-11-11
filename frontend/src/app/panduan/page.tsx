import type { Metadata } from "next";
import Link from "next/link";
import Faq from "@/components/Faq";
import QuickStart from "@/components/QuickStart";
import SiteShell from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Panduan instalasi — MiB",
  description: "Memasang MiB di Windows dan menyiapkannya dalam beberapa menit.",
};

const STEPS: { title: string; body: string; extra?: string; href?: [string, string] }[] = [
  {
    title: "Unduh pemasang",
    body: "Buka halaman Unduh dan klik Unduh MiB. Ukurannya sekitar 170 MB.",
    href: ["/unduh", "Ke halaman Unduh"],
  },
  {
    title: "Jalankan pemasang",
    body: "Buka berkas MiB Setup yang terunduh dan ikuti wizard. Bila Windows SmartScreen muncul, pilih Info lainnya, lalu Tetap jalankan.",
    extra: "Pemasang belum ditandatangani, jadi peringatan itu wajar. Cocokkan SHA-256 di halaman Unduh bila ingin memastikan keasliannya.",
  },
  {
    title: "Buat akun",
    body: "Buka MiB dan buat akun. Akun pertama di komputer ini otomatis menjadi admin.",
  },
  {
    title: "Masukkan kode lisensi",
    body: "Buka Pengaturan dan tempel kode lisensi MiB Anda. MiB memeriksanya sebelum menyimpan. Tidak ada kunci atau akun lain yang perlu disiapkan.",
    href: ["/docs/pengaturan-awal", "Cara memasang kode lisensi"],
  },
  {
    title: "Pilih folder yang boleh diakses",
    body: "Buka Pengaturan, Folder lokal, tambahkan folder kerja Anda. Pilih Hanya baca bila MiB cukup melihat, atau Baca dan tulis bila ia boleh membuat dan mengubah berkas.",
    href: ["/docs/folder-izin", "Tentang folder dan izin"],
  },
  {
    title: "Beri tugas pertama",
    body: "Kembali ke chat dan coba, misalnya: tolong lihat isi folder Dokumen, atau buat surat penawaran di Word. Setiap tindakan yang mengubah sesuatu akan meminta persetujuan Anda.",
  },
];

export default function PanduanPage() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-3xl px-5 py-14 sm:py-20">
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">Panduan instalasi</h1>
        <p className="mt-4 text-lg text-muted">Dari unduhan sampai tugas pertama, sekitar sepuluh menit.</p>

        <div className="mt-8 flex flex-wrap gap-2 text-sm">
          {["Windows 10 / 11 (64-bit)", "±500 MB ruang kosong", "Koneksi internet", "Kode lisensi MiB"].map((r) => (
            <span key={r} className="rounded-full border border-line px-3 py-1 text-muted">
              {r}
            </span>
          ))}
        </div>

        <ol className="mt-12 space-y-0">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative flex gap-5 pb-10 last:pb-0">
              {i < STEPS.length - 1 && <span aria-hidden className="absolute left-[15px] top-9 h-[calc(100%-2.25rem)] w-px bg-line" />}
              <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-accent/50 bg-background text-sm font-semibold text-accent-strong">
                {i + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <h2 className="text-lg font-semibold">{s.title}</h2>
                <p className="mt-1.5 text-muted">{s.body}</p>
                {s.extra && <p className="mt-2 text-sm text-muted">{s.extra}</p>}
                {s.href && (
                  <Link href={s.href[0]} className="mt-2 inline-block text-sm text-accent-strong hover:underline">
                    {s.href[1]} →
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight">Cara cepat lewat PowerShell</h2>
          <p className="mt-2 text-muted">Bila Anda lebih suka terminal, satu perintah sudah cukup.</p>
          <QuickStart />
        </section>

        <section id="faq" className="mt-16 scroll-mt-24">
          <h2 className="text-2xl font-semibold tracking-tight">Pertanyaan umum</h2>
          <div className="mt-5">
            <Faq />
          </div>
          <p className="mt-6 text-sm text-muted">
            Masih bermasalah? Lihat{" "}
            <Link href="/docs/pemecahan-masalah" className="text-accent-strong hover:underline">
              Pemecahan masalah
            </Link>
            .
          </p>
        </section>
      </div>
    </SiteShell>
  );
}
