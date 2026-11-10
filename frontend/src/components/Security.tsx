import { ShieldCheck } from "lucide-react";
import Reveal from "./Reveal";
import Script from "./Script";
import SecurityLayers from "./SecurityLayers";

export default function Security() {
  return (
    <section
      id="keamanan"
      className="mx-auto flex w-full max-w-6xl flex-1 scroll-mt-16 items-center px-5 py-12 sm:py-16 lg:py-20"
    >
      <div className="w-full">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
            Dirancang <Script>aman</Script>, bukan ditambal belakangan
          </h2>
        </Reveal>

        {/* Empat lapis: selalu mulai tertutup, dibuka dengan diketuk */}
        <SecurityLayers />

        {/* Prinsip Man in Bot */}
        <Reveal delay={0.1}>
          <div className="fx-shimmer mt-3 flex flex-col gap-4 rounded-3xl border border-accent/30 bg-gradient-to-r from-accent/10 to-shield/20 p-5 sm:mt-5 sm:flex-row sm:items-center sm:p-7">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-background/60 text-accent-strong ring-1 ring-accent/30">
              <ShieldCheck className="size-6" />
            </span>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">
                Manusia tetap di dalam lingkaran
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                <span className="sm:hidden">
                  Alat yang berdampak, seperti kirim email atau ubah file, akan
                  menunggu persetujuan Anda.
                </span>
                <span className="hidden sm:inline">
                  Menulis berkas, menjalankan perintah shell, dan menyimpan
                  dokumen selalu menunggu persetujuan Anda, hanya di folder yang
                  Anda izinkan, dan tercatat di log audit.
                </span>
              </p>
            </div>
            <span className="self-start rounded-md border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-medium text-accent-strong sm:self-center">
              Aktif
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
