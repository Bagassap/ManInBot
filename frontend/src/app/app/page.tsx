import type { Metadata } from "next";
import ChatApp from "@/components/ChatApp";

export const metadata: Metadata = { title: "MiB — Mode Perintah" };

export default function AppPage() {
  return <ChatApp />;
}
