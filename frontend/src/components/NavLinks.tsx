"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export interface NavChild {
  label: string;
  href: string;
  desc?: string;
}
export type NavItem =
  | { label: string; href: string; arrow?: boolean }
  | { label: string; children: NavChild[] };

const isGroup = (i: NavItem): i is Extract<NavItem, { children: NavChild[] }> => "children" in i;

/** Menu bertingkat: klik atau arahkan kursor, tutup dengan Esc atau klik di luar. */
function Group({ item, active }: { item: Extract<NavItem, { children: NavChild[] }>; active: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <li ref={box} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 py-1 transition-colors ${active || open ? "text-foreground" : "text-muted hover:text-foreground"}`}
      >
        {item.label}
        <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="absolute left-1/2 top-full z-50 w-64 -translate-x-1/2 pt-3">
          <div className="rounded-2xl border border-line bg-background p-2 shadow-xl">
            {item.children.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-background"
              >
                <span className="block text-sm font-medium text-foreground">{c.label}</span>
                {c.desc && <span className="mt-0.5 block text-xs text-muted">{c.desc}</span>}
              </Link>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}

/** Menu topbar; bagian aktif ditandai garis yang bergeser mulus mengikuti halaman. */
export default function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <ul className="hidden items-center gap-8 text-sm md:flex">
      {items.map((it) => {
        if (isGroup(it)) {
          return <Group key={it.label} item={it} active={pathname === "/fitur"} />;
        }
        const on = pathname === it.href || pathname.startsWith(`${it.href}/`);
        return (
          <li key={it.href}>
            <Link
              href={it.href}
              aria-current={on ? "page" : undefined}
              className={`relative flex items-center gap-1 py-1 transition-colors ${on ? "text-foreground" : "text-muted hover:text-foreground"}`}
            >
              {it.label}
              {it.arrow && <ArrowUpRight className="size-3.5" />}
              {on && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-x-0 -bottom-1 h-px bg-accent-strong shadow-[0_0_10px_var(--accent-strong)]"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
