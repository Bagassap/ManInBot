import Link from "next/link";
import { DOCS, GROUPS } from "@/lib/docs";

export default function DocsIndex() {
  return (
    <article>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Dokumentasi MiB</h1>
      <p className="mt-3 hidden max-w-2xl text-muted sm:block">
        Cara memasang dan memakai MiB.
      </p>
      <div className="mt-10 space-y-10">
        {GROUPS.map((g) => (
          <section key={g}>
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted">{g}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {DOCS.filter((d) => d.group === g).map((d) => (
                <Link
                  key={d.slug}
                  href={`/docs/${d.slug}`}
                  className="rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-accent/50"
                >
                  <h3 className="font-medium">{d.title}</h3>
                  <p className="mt-1.5 hidden text-sm text-muted sm:block">{d.summary}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
