import type { Metadata, Viewport } from "next";
import { Geist_Mono, Instrument_Serif, Sora } from "next/font/google";
import localFont from "next/font/local";
import NextScript from "next/script";
import "./globals.css";

// Satoshi (Fontshare, ITF Free Font License, di-host sendiri): teks & UI. Sora: judul.
const satoshi = localFont({
  src: [
    { path: "../fonts/satoshi-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/satoshi-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/satoshi-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-satoshi",
  display: "swap",
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

// Aksen satu kata di judul: italic elegan bergaya editorial (lihat Script.tsx).
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MiB — Man in Bot",
  description:
    "MiB adalah agen AI khusus pekerjaan kantor: menyusun dokumen Word dan PowerPoint, mengolah data, merapikan berkas, dan mengoperasikan aplikasi kantor di komputer Anda, dengan persetujuan Anda.",
  icons: { icon: "/asset/logo-mark-v2.png", apple: "/asset/logo-mark-v2.png" },
};

export const viewport: Viewport = {
  themeColor: "#020202",
};

// Saat halaman di-refresh, selalu mulai dari paling atas. Browser memulihkan posisi gulir (dan hash
// #bagian) sendiri, kadang setelah skrip pertama berjalan, jadi: matikan pemulihan, buang hash, lalu
// jaga posisi di atas sampai pengguna menyentuh layar atau menggulir sendiri (maks. 5 detik).
// Navigasi biasa dan tombol kembali tidak terpengaruh.
const RESET_ON_RELOAD = `(function(){try{var n=performance.getEntriesByType("navigation")[0];if(!n||n.type!=="reload")return;history.scrollRestoration="manual";if(location.hash){history.replaceState(null,"",location.pathname+location.search)}var top=function(){try{window.scrollTo({top:0,left:0,behavior:"instant"})}catch(e){window.scrollTo(0,0)}};top();var done=false;var end=function(){done=true};["wheel","touchstart","keydown","mousedown"].forEach(function(t){window.addEventListener(t,end,{once:true,passive:true})});window.addEventListener("scroll",function(){if(!done&&window.scrollY!==0)top()},{passive:true});setTimeout(end,5000)}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      data-scroll-behavior="smooth"
      className={`${satoshi.variable} ${sora.variable} ${instrument.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextScript id="reset-on-reload" strategy="beforeInteractive">
          {RESET_ON_RELOAD}
        </NextScript>
        {children}
      </body>
    </html>
  );
}
