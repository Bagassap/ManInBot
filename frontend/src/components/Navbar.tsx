import Image from "next/image";
import Link from "next/link";
import MobileMenu from "./MobileMenu";
import NavLinks, { type NavItem } from "./NavLinks";

const items: NavItem[] = [
  { label: "Install", href: "/docs/instalasi" },
  {
    label: "Produk",
    children: [
      { label: "Ikhtisar", href: "/fitur", desc: "Yang bisa dikerjakan MiB" },
      { label: "Integrasi", href: "/#integrasi", desc: "Dokumen, folder, dan aplikasi kantor" },
      { label: "Showcase", href: "/#contoh", desc: "Batasan yang menjaga privasi Anda" },
      { label: "Enterprise", href: "/fitur#tim", desc: "Tim, peran, dan jejak audit" },
    ],
  },
  { label: "Dokumentasi", href: "/docs", arrow: true },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/asset/logo-mark-v2.png" alt="" width={32} height={36} className="shrink-0" priority />
          <span className="font-display text-xl font-semibold tracking-tight">MiB</span>
        </Link>

        <div className="ml-auto flex items-center gap-4 sm:gap-8">
          <NavLinks items={items} />
          <div className="flex items-center gap-3">
            <Link
              href="/unduh"
              className="fx-btn rounded-xl bg-accent px-4 py-2 text-sm font-medium text-[#0d1417] transition-colors hover:bg-accent-strong"
            >
              Unduh
            </Link>
            <MobileMenu items={items} />
          </div>
        </div>
      </nav>
    </header>
  );
}
