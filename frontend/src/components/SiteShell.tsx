import type { ReactNode } from "react";
import BackgroundFX from "./BackgroundFX";
import Navbar from "./Navbar";
import SiteFooter from "./SiteFooter";

/** Kerangka halaman situs promosi: latar, navigasi, isi, dan footer. */
export default function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <BackgroundFX />
      <Navbar />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
