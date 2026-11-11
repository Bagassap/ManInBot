"use client";

import { ArrowUpRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { NavItem } from "./NavLinks";

/** Menu navigasi untuk layar sempit (menu horizontal disembunyikan di bawah lebar md). */
export default function MobileMenu({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const row = "flex items-center gap-1 py-3 text-muted transition-colors hover:text-foreground";
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
        <nav className="absolute inset-x-0 top-16 max-h-[calc(100svh-4rem)] overflow-y-auto border-b border-line bg-background px-5 py-3">
          <ul className="flex flex-col">
            {items.map((it) =>
              "children" in it ? (
                <li key={it.label} className="py-1">
                  <p className="pt-2 text-xs font-medium uppercase tracking-wider text-muted">{it.label}</p>
                  <ul className="mt-1 border-l border-line pl-4">
                    {it.children.map((c) => (
                      <li key={c.href}>
                        <Link href={c.href} onClick={close} className={row}>
                          {c.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ) : (
                <li key={it.href}>
                  <Link href={it.href} onClick={close} className={row}>
                    {it.label}
                    {it.arrow && <ArrowUpRight className="size-3.5" />}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </nav>
      )}
    </div>
  );
}
