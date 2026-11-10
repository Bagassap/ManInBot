import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import DocBlocks from "@/components/DocBlocks";
import { DOCS, docBySlug, neighbours } from "@/lib/docs";

export function generateStaticParams() {
  return DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata(props: PageProps<"/docs/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const doc = docBySlug(slug);
  return doc ? { title: `${doc.title} — Dokumentasi MiB`, description: doc.summary } : {};
}

export default async function DocPage(props: PageProps<"/docs/[slug]">) {
  const { slug } = await props.params;
  const doc = docBySlug(slug);
  if (!doc) notFound();
  const { prev, next } = neighbours(slug);

  return (
    <article>
      <p className="text-sm text-accent-strong">{doc.group}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{doc.title}</h1>
      <p className="mt-3 max-w-2xl text-muted">{doc.summary}</p>
      <div className="mt-8">
        <DocBlocks blocks={doc.blocks} />
      </div>
      <nav aria-label="Halaman lain" className="mt-14 grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
        {prev ? (
          <Link href={`/docs/${prev.slug}`} className="rounded-xl border border-line p-4 transition-colors hover:border-accent/50">
            <span className="text-xs text-muted">Sebelumnya</span>
            <span className="mt-1 block font-medium">{prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={`/docs/${next.slug}`} className="rounded-xl border border-line p-4 text-right transition-colors hover:border-accent/50">
            <span className="text-xs text-muted">Berikutnya</span>
            <span className="mt-1 block font-medium">{next.title}</span>
          </Link>
        )}
      </nav>
    </article>
  );
}
