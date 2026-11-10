import type { Metadata } from "next";
import DownloadApp from "@/components/DownloadApp";
import SiteShell from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Unduh MiB",
  description: "Pasang MiB di komputer Anda sendiri.",
};

export default function Page() {
  return (
    <SiteShell>
      <DownloadApp />
    </SiteShell>
  );
}
