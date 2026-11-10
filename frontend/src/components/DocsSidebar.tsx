"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS, GROUPS } from "@/lib/docs";

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Dokumentasi" className="space-y-6 text-sm">
      {GROUPS.map((g) => (
        <div key={g}>
          <h3 className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted">{g}</h3>
          <ul className="space-y-0.5">
            {DOCS.filter((d) => d.group === g).map((d) => {
              const on = pathname === `/docs/${d.slug}`;
              return (
                <li key={d.slug}>
                  <Link
                    href={`/docs/${d.slug}`}
                    onClick={onNavigate}
                    aria-current={on ? "page" : undefined}
                    className={`block rounded-lg px-3 py-1.5 transition-colors ${on ? "bg-accent/15 text-accent-strong" : "text-muted hover:bg-surface hover:text-foreground"}`}
                  >
                    {d.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Sidebar dokumentasi: tetap di samping pada layar lebar, lipat (details) pada layar sempit. */
export default function DocsSidebar() {
  return (
    <>
      <aside className="sticky top-24 hidden max-h-[calc(100svh-7rem)] w-60 shrink-0 self-start overflow-y-auto lg:block">
        <Nav />
      </aside>
      <details className="mb-6 rounded-xl border border-line bg-surface lg:hidden">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          Daftar isi dokumentasi
        </summary>
        <div className="border-t border-line p-3">
          <Nav />
        </div>
      </details>
    </>
  );
}
