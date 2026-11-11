import Image from "next/image";
import Link from "next/link";

const COLS: [string, [string, string][]][] = [
  ["Produk", [["Unduh", "/unduh"], ["Fitur", "/fitur"], ["Panduan instalasi", "/panduan"]]],
  ["Dokumentasi", [["Ikhtisar", "/docs/ikhtisar"], ["Mulai cepat", "/docs/mulai-cepat"], ["Instalasi", "/docs/instalasi"], ["Konfigurasi", "/docs/konfigurasi"]]],
  ["Bantuan", [["FAQ", "/panduan#faq"]]],
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 text-sm sm:grid-cols-4">
        <div>
          <span className="flex items-center gap-2 font-medium">
            <Image src="/asset/logo-mark-v2.png" alt="" width={18} height={20} className="shrink-0" />
            MiB — Man in Bot
          </span>
          <p className="mt-3 text-muted">Agen AI yang bekerja di komputer Anda.</p>
        </div>
        {COLS.map(([h, items]) => (
          <div key={h}>
            <h4 className="font-medium">{h}</h4>
            <ul className="mt-3 space-y-2 text-muted">
              {items.map(([l, href]) => (
                <li key={l}>
                  <Link href={href} className="transition-colors hover:text-foreground">
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-muted">© 2026 MiB. Hak cipta dilindungi.</div>
    </footer>
  );
}
