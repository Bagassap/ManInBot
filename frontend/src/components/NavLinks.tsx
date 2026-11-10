"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Menu topbar; bagian aktif ditandai garis yang bergeser mulus mengikuti halaman. */
export default function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <ul className="hidden items-center gap-8 text-sm md:flex">
      {links.map((l) => {
        const on = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={on ? "page" : undefined}
              className={`relative block py-1 transition-colors ${on ? "text-foreground" : "text-muted hover:text-foreground"}`}
            >
              {l.label}
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
