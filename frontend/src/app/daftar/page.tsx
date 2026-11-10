import type { Metadata } from "next";
import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";
import BackgroundFX from "@/components/BackgroundFX";

export const metadata: Metadata = { title: "Daftar — MiB" };

export default function DaftarPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-16">
      <BackgroundFX />
      {/* useSearchParams (pesan galat Google) wajib berada di dalam Suspense */}
      <Suspense fallback={null}>
        <AuthForm mode="daftar" />
      </Suspense>
    </main>
  );
}
