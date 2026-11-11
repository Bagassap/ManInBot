import Link from "next/link";
import BackgroundFX from "@/components/BackgroundFX";
import FloatingMark from "@/components/FloatingMark";
import HeroTitle from "@/components/HeroTitle";
import Script from "@/components/Script";
import ScrollProgress from "@/components/ScrollProgress";
import QuickStart from "@/components/QuickStart";
import Navbar from "@/components/Navbar";
import Reveal from "@/components/Reveal";
import Security from "@/components/Security";
import Faq from "@/components/Faq";
import SiteFooter from "@/components/SiteFooter";
import Splash from "@/components/Splash";

export default function Home() {
  return (
    <>
      <Splash />
      <BackgroundFX />
      <ScrollProgress />
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[-10%] size-[640px] -translate-x-1/2 rounded-full bg-accent/[0.04] blur-[130px]"
          />
          <div className="relative mx-auto flex max-w-4xl flex-col items-center px-5 pb-12 pt-12 text-center sm:pb-20 sm:pt-24 lg:pb-24 lg:pt-28">
            <FloatingMark />
            <p className="mt-8 rounded-full border border-line px-4 py-1.5 text-xs text-muted">
              <span className="sm:hidden">Berjalan di komputer Anda · Atas izin Anda</span>
              <span className="hidden sm:inline">
                Berjalan di komputer Anda · Data tetap milik Anda · Setiap tindakan atas izin Anda
              </span>
            </p>
            <HeroTitle />
            <Reveal delay={0.55} variant="blur" afterSplash>
              <p className="mt-6 max-w-2xl text-pretty text-base text-muted sm:text-lg">
                <span className="sm:hidden">
                  Surat, laporan, presentasi, dan data kantor, dikerjakan dari
                  satu chat.
                </span>
                <span className="hidden sm:inline">
                  Khusus pekerjaan kantor: menyusun surat, laporan, dan
                  presentasi, mengolah data, merapikan berkas, hingga membuka
                  dan mengoperasikan Word, Excel, dan PowerPoint di komputer
                  Anda. Semua dari satu chat, dan setiap tindakan penting
                  menunggu persetujuan Anda.
                </span>
              </p>
            </Reveal>
            <Reveal
              delay={0.7}
              variant="blur"
              afterSplash
              className="mt-10 flex flex-wrap justify-center gap-3"
            >
              <a
                href="/unduh"
                className="fx-btn rounded-xl bg-accent px-6 py-3 font-medium text-[#0d1417] transition-colors hover:bg-accent-strong"
              >
                Unduh untuk Windows
              </a>
              <a
                href="#cara-kerja"
                className="rounded-xl border border-line px-6 py-3 font-medium transition-colors hover:bg-surface"
              >
                Lihat cara kerja
              </a>
              <a
                href="#keamanan"
                className="rounded-xl border border-line px-6 py-3 font-medium transition-colors hover:bg-surface"
              >
                Soal keamanan
              </a>
            </Reveal>
          </div>
        </section>

        {/* Cara kerja + contoh tugas */}
        <section id="cara-kerja" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight">Pasang sekali, MiB bekerja di komputer Anda</h2>
            <p className="mt-2 hidden max-w-2xl text-muted sm:block">
              MiB bukan aplikasi web. Ia terpasang di komputer Anda, memakai
              aplikasi dan berkas yang sudah ada di sana, lalu mengerjakan
              tugas seperti asisten yang duduk di depan layar yang sama.
            </p>
          </Reveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ["1", "Unduh dan pasang", "Satu pemasang untuk Windows. Tanpa pengaturan rumit."],
              ["2", "Beri izin", "Pilih folder yang boleh diakses MiB. Setiap tindakan penting meminta persetujuan Anda."],
              ["3", "Beri perintah", "Ketik tugasnya di chat. MiB membuka aplikasi dan mengerjakannya sendiri di layar."],
            ].map(([n, t, d]) => (
              <Reveal key={n}>
                <div className="h-full rounded-2xl border border-line bg-surface p-6">
                  <span className="flex size-8 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent-strong">{n}</span>
                  <h3 className="mt-4 text-lg font-medium">{t}</h3>
                  <p className="mt-2 text-sm text-muted">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <h3 className="mt-12 text-xl font-semibold">Contoh yang bisa Anda minta</h3>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                "“Buka Word dan ketik surat penawaran untuk PT Maju, lalu simpan di folder Dokumen.”",
                "“Rapikan semua berkas di folder Unduhan berdasarkan jenisnya.”",
                "“Baca laporan.docx dan buat ringkasannya dalam 5 slide PowerPoint.”",
                "“Olah data penjualan di Excel dan buat tabel rekap per bulan.”",
              ].map((q, i) => (
                <li key={q} className={`rounded-xl border border-line px-4 py-3 text-sm text-muted ${i >= 2 ? "hidden sm:block" : ""}`}>{q}</li>
              ))}
            </ul>
          </Reveal>
        </section>

        {/* Mulai cepat */}
        <section id="mulai" className="mx-auto max-w-3xl scroll-mt-24 px-5 py-16">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight">Mulai cepat</h2>
            <p className="mt-2 hidden text-muted sm:block">
              Satu perintah, atau unduh aplikasinya. Tanpa pengaturan teknis
              yang perlu Anda lakukan.
            </p>
            <QuickStart />
          </Reveal>

          <Reveal>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                ["Windows", "10 / 11 · x64", "Tersedia", "/unduh"],
                ["macOS", "Apple Silicon & Intel", "Segera", ""],
                ["Linux", "AppImage · .deb", "Segera", ""],
              ].map(([os, req, st, href]) => (
                <div key={os} className="rounded-2xl border border-line bg-surface p-5">
                  <h3 className="font-medium">{os}</h3>
                  <p className="mt-1 text-sm text-muted">{req}</p>
                  {href ? (
                    <Link
                      href={href}
                      className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-[#0d1417] transition-colors hover:bg-accent-strong"
                    >
                      Unduh
                    </Link>
                  ) : (
                    <span className="mt-4 inline-block rounded-lg border border-line px-4 py-2 text-sm text-muted">
                      {st}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* Apa yang bisa dilakukan */}
        <section id="fitur" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight">Apa yang bisa dilakukan</h2>
          </Reveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Berjalan di komputer Anda", "Aplikasi desktop. Berkas dan data kerja Anda tetap disimpan di komputer Anda sendiri."],
              ["Akses folder terpilih", "Anda menentukan folder yang boleh dibaca atau ditulis. Di luar itu, MiB tidak bisa menyentuh apa pun."],
              ["Semua dokumen kantor", "Membaca, membuat, dan mengubah dokumen Word dan PowerPoint, mengolah Excel, membaca PDF, lalu membukanya di aplikasi Anda."],
              ["Perintah shell", "Menjalankan perintah PowerShell untuk tugas teknis. Selalu menunggu Izinkan dari Anda."],
              ["Mengoperasikan aplikasi kantor Anda", "MiB melihat layar, menggerakkan mouse, dan mengetik sendiri di Word, Excel, PowerPoint, atau Outlook, langsung di depan Anda. Hanya dengan izin, dan bisa dihentikan kapan saja dengan Esc."],
              ["Tim & jejak audit", "Workspace per kantor, anggota dengan peran, dan log audit untuk setiap tindakan agen."],
            ].map(([t, d]) => (
              <Reveal key={t}>
                <div className="h-full rounded-2xl border border-line bg-surface p-6">
                  <h3 className="text-lg font-medium">{t}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-muted sm:line-clamp-none">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <div className="-mt-8 pb-8 text-center">
          <Link href="/fitur" className="text-sm text-accent-strong hover:underline">
            Lihat semua fitur →
          </Link>
        </div>

        {/* Terhubung ke */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight">Bekerja dengan</h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Kecerdasan AI", "Sudah termasuk di akun MiB"],
                ["Dokumen", "Word, PowerPoint, Excel"],
                ["Folder lokal", "Berkas dan dokumen kantor"],
                ["PowerShell", "Otomasi di Windows"],
                ["Kontrol layar", "Mouse & keyboard (Windows)"],
                ["WhatsApp & Telegram", "Segera"],
                ["Email & Kalender", "Segera"],
                ["Skills & plugin", "Segera"],
              ].map(([n, d]) => (
                <div key={n} className="rounded-xl border border-line px-4 py-3">
                  <div className="font-medium">{n}</div>
                  <div className="text-sm text-muted">{d}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </section>


        {/* Bagian akhir: cukup tinggi agar menu "Keamanan" bisa menggulir sampai ke bawah topbar
            (tanpa ini, di layar tinggi bagian sebelumnya ikut mengintip di atasnya). */}
        <div className="flex min-h-[calc(100svh-9rem)] flex-col">
          <Security />

          {/* FAQ */}
          <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-5 pb-16">
            <Reveal>
              <h2 className="text-3xl font-semibold tracking-tight">Pertanyaan umum</h2>
              <div className="mt-6">
                <Faq />
              </div>
              <p className="mt-4 text-sm text-muted">
                Ada pertanyaan lain? Baca{" "}
                <Link href="/docs" className="text-accent-strong hover:underline">
                  dokumentasi lengkap
                </Link>
                .
              </p>
            </Reveal>
          </section>

          {/* CTA */}
          <section className="mx-auto max-w-4xl px-5 pb-12 sm:pb-16 lg:pb-24">
            <Reveal>
              <div className="fx-gradient fx-shimmer rounded-3xl border border-line bg-gradient-to-br from-shield/40 via-surface to-accent/15 p-8 text-center sm:p-14">
                <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                  Tarik kursi, <Script>mulai</Script> bersama MiB.
                </h2>
                <p className="mx-auto mt-3 max-w-lg text-muted">
                  Pasang di komputer Anda dan beri perintah pertama.
                </p>
                <Link
                  href="/unduh"
                  className="fx-btn mt-8 inline-block rounded-xl bg-accent px-7 py-3 font-medium text-[#0d1417] transition-colors hover:bg-accent-strong"
                >
                  Unduh MiB
                </Link>
              </div>
            </Reveal>
          </section>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
