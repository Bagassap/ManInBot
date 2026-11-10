"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/** Menu navigasi untuk layar sempit (menu horizontal disembunyikan di bawah lebar md). */
export default function MobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        aria-label={open ? "Tutup menu" : "Buka menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex size-10 items-center justify-center rounded-lg border border-line"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      {open && (
        <nav className="absolute inset-x-0 top-16 border-b border-line bg-background/95 px-5 py-3 backdrop-blur-md">
          <ul className="flex flex-col">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOpen(false)} className="block py-3 text-muted transition-colors hover:text-foreground">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
