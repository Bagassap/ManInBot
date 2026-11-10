import type { Metadata } from "next";
import SettingsApp from "@/components/SettingsApp";

export const metadata: Metadata = { title: "MiB — Pengaturan" };

export default function SettingsPage() {
  return <SettingsApp />;
}
