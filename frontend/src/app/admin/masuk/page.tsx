import type { Metadata } from "next";
import AdminLogin from "@/components/admin/AdminLogin";

export const metadata: Metadata = {
  title: "Masuk admin — MiB",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return <AdminLogin />;
}
