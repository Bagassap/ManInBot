import type { Metadata } from "next";
import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";
import BackgroundFX from "@/components/BackgroundFX";

export const metadata: Metadata = { title: "Masuk — MiB" };

export default function MasukPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-16">
      <BackgroundFX />
      {/* useSearchParams (pesan galat Google) wajib berada di dalam Suspense */}
      <Suspense fallback={null}>
        <AuthForm mode="masuk" />
      </Suspense>
    </main>
  );
}
