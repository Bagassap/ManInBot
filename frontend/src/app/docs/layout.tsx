import type { Metadata } from "next";
import DocsSidebar from "@/components/DocsSidebar";
import SiteShell from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Dokumentasi — MiB",
  description: "Panduan memasang dan memakai MiB, agen AI yang bekerja di komputer Anda.",
};

export default function DocsLayout({ children }: LayoutProps<"/docs">) {
  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-5 py-10 lg:flex lg:gap-12 lg:py-14">
        <DocsSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </SiteShell>
  );
}
