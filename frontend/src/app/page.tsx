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

const MODELS = [
  {
    name: "Ringan",
    intro: "Untuk komputer kantor sederhana yang tetap harus lancar dipakai bekerja.",
    cpu: "Core i3 / Ryzen 3",
    ram: "4–8 GB",
    download: "±3 GB",
    disk: "±8 GB",
    uses: ["Surat dan email pendek", "Meringkas teks singkat", "Merapikan kalimat dan ejaan"],
    note: "Hasil terbaik bila tugas diberikan satu per satu.",
  },
  {
    name: "Sedang",
    intro: "Pilihan seimbang untuk sebagian besar komputer kantor.",
    cpu: "Core i5 / Ryzen 5",
    ram: "8 GB ke atas",
    download: "±4 GB",
    disk: "±9 GB",
    uses: ["Laporan dan notulen rapat", "Tabel dan rekap di Excel", "Slide PowerPoint dari dokumen"],
    note: "Cocok untuk pekerjaan kantor sehari-hari.",
  },
  {
    name: "Kuat",
    intro: "Untuk komputer bertenaga dan pekerjaan yang lebih panjang.",
    cpu: "Core i7 / Ryzen 7",
    ram: "16 GB ke atas",
    download: "±7 GB",
    disk: "±12 GB",
    uses: ["Dokumen panjang", "Tugas dengan banyak langkah", "Menggabungkan isi beberapa berkas"],
    note: "Memakai RAM paling besar, jadi tutup aplikasi berat yang tidak dipakai.",
  },
];

export default function Home() {
  return (
    <>
      <Splash />
      <BackgroundFX />
      <ScrollProgress />
      <Navbar />

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[-10%] size-[640px] -translate-x-1/2 rounded-full bg-accent/[0.04] blur-[130px]"
          />
          <div className="relative mx-auto flex max-w-4xl flex-col items-center px-5 pb-12 pt-12 text-center sm:pb-20 sm:pt-24 lg:pb-24 lg:pt-28">
            <FloatingMark />
            <p className="mt-8 rounded-full border border-line px-4 py-1.5 text-xs text-muted">
              <span className="sm:hidden">Gratis · Offline · Atas izin Anda</span>
              <span className="hidden sm:inline">
                Gratis · Berjalan offline di komputer Anda · Setiap tindakan atas izin Anda
              </span>
            </p>
            <HeroTitle />
            <Reveal delay={0.55} variant="blur" afterSplash>
              <p className="mt-6 max-w-2xl text-pretty text-base text-muted sm:text-lg">
                <span className="sm:hidden">
                  Buat dan edit documents, spreadsheet, dan slides. Gratis dan
                  offline.
                </span>
                <span className="hidden sm:inline">
                  Buat dan edit documents, spreadsheet, dan slides lewat
                  percakapan. AI berjalan offline di komputer Anda, dengan tiga
                  model gratis sesuai spesifikasi PC.
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
                Unduh gratis untuk Windows
              </a>
              <a
                href="#model"
                className="rounded-xl border border-line px-6 py-3 font-medium transition-colors hover:bg-surface"
              >
                Lihat 3 model
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

        <section id="model" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight">Tiga model gratis, semuanya offline</h2>
            <p className="mt-2 hidden max-w-2xl text-muted sm:block">
              Cukup satu file pemasang. Saat pertama dibuka, MiB memeriksa komputer Anda dan menyarankan
              model yang cocok. Setelah terpasang, pekerjaan Anda tidak dikirim ke internet.
            </p>
          </Reveal>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {MODELS.map((m) => (
              <Reveal key={m.name}>
                <article className="flex h-full flex-col rounded-2xl border border-line bg-surface p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">{m.name}</h3>
                    <span className="rounded-md bg-accent/15 px-2 py-1 text-xs text-accent-strong">Gratis</span>
                  </div>
                  <p className="mt-2 text-sm text-muted">{m.intro}</p>
                  <dl className="mt-4 space-y-1.5 border-y border-line py-3 text-sm">
                    {[
                      ["Prosesor", m.cpu],
                      ["RAM", m.ram],
                      ["Unduhan", m.download],
                      ["Ruang kosong", m.disk],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3">
                        <dt className="text-muted">{k}</dt>
                        <dd className="text-right">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <h4 className="mt-4 text-sm font-medium">Paling cocok untuk</h4>
                  <ul className="mt-2 flex-1 space-y-1.5 text-sm text-muted">
                    {m.uses.map((u) => (
                      <li key={u} className="flex gap-2">
                        <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-accent-strong" />
                        {u}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 rounded-lg bg-background/60 px-3 py-2 text-xs leading-relaxed text-muted">{m.note}</p>
                </article>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <div className="mt-4 rounded-2xl border border-line bg-surface p-6">
              <h3 className="text-lg font-medium">Bingung memilih?</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Tidak perlu memutuskan sekarang. Setelah MiB terpasang, aplikasi memeriksa prosesor dan RAM lalu menandai
                model yang disarankan. Ketiganya punya fitur yang sama. Model yang lebih besar lebih mampu menangani
                tugas panjang, tetapi memakai lebih banyak RAM dan ruang disk. Bila terasa lambat, ganti ke model yang
                lebih ringan kapan saja di Pengaturan.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <a href="/unduh" className="fx-btn inline-block rounded-xl bg-accent px-6 py-3 font-medium text-[#0d1417] transition-colors hover:bg-accent-strong">
                  Unduh MiB
                </a>
                <Link href="/docs/model" className="text-sm text-accent-strong hover:underline">
                  Baca panduan model →
                </Link>
              </div>
              <p className="mt-2 text-xs text-muted">Satu pemasang untuk semua. Model dipilih di aplikasi setelah MiB terpasang.</p>
            </div>
          </Reveal>
          <Reveal>
            <div id="online" className="mt-4 flex scroll-mt-24 flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-line p-6">
              <div>
                <h3 className="text-lg font-medium">MiB Online</h3>
                <p className="mt-1 text-sm text-muted">Versi dengan AI di cloud untuk tugas yang lebih berat.</p>
              </div>
              <span className="rounded-lg border border-line px-4 py-2 text-sm text-muted">Akan tersedia</span>
            </div>
          </Reveal>
        </section>

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
              ["1", "Unduh dan pilih model", "Pasang satu file MiB. Saat pertama dibuka, MiB memeriksa PC Anda dan Anda memilih modelnya."],
              ["2", "Daftar akun MiB", "Isi email, kata sandi, dan data diri, lalu pilih folder yang boleh diakses."],
              ["3", "Beri perintah", "Mulai percakapan, MiB membuka aplikasi dan mengerjakannya sendiri di layarmu."],
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
            <h3 id="contoh" className="mt-12 scroll-mt-24 text-xl font-semibold">Keterbatasan adalah kesempurnaan untuk kami</h3>
            <p className="mt-3 max-w-2xl text-sm text-muted sm:text-base">
              Demi menjaga privasi Anda, MiB hanya diprogram untuk bisa berkomunikasi dengan Anda dan tidak diizinkan mengirim dokumen ke luar komputer Anda.
            </p>
            <p className="mt-3 max-w-2xl text-sm text-muted sm:text-base">
              MiB hanya diprogram untuk menjalankan Spreadsheet, Documents, dan Slides, sehingga tidak perlu khawatir MiB melakukan sesuatu dengan aplikasi lain di komputer Anda.
            </p>
          </Reveal>
        </section>

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
              ["Mengoperasikan aplikasi kantor Anda", "MiB membaca tombol dan menu lalu mengetik sendiri di Word, Excel, PowerPoint, atau Outlook, langsung di depan Anda. Hanya dengan izin, dan bisa dihentikan kapan saja dengan Esc."],
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

        <section id="integrasi" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight">Bekerja dengan</h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Kecerdasan AI", "Offline di komputer Anda"],
                ["Dokumen", "Word, PowerPoint, Excel"],
                ["Folder lokal", "Berkas dan dokumen kantor"],
                ["PowerShell", "Otomasi di Windows"],
                ["Kontrol Office", "Tombol, menu, dan keyboard"],
                ["Email & Kalender", "Segera"],
                ["Skills & plugin", "Segera"],
                ["MiB Online", "Akan tersedia"],
              ].map(([n, d]) => (
                <div key={n} className="rounded-xl border border-line px-4 py-3">
                  <div className="font-medium">{n}</div>
                  <div className="text-sm text-muted">{d}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </section>


        <div className="flex min-h-[calc(100svh-9rem)] flex-col">
          <Security />

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
