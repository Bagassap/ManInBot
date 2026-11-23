import type { Metadata } from "next";
import AppGate from "@/components/AppGate";

export const metadata: Metadata = { title: "MiB — Mode Perintah" };

export default function AppPage() {
  return <AppGate />;
}
