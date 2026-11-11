"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Halaman Panduan lama digabung ke dokumentasi; alamat lama diarahkan ke sana. */
export default function PanduanPage() {
  useEffect(() => {
    window.location.replace("/docs/mulai-cepat");
  }, []);
  return (
    <p className="p-8 text-center text-sm text-muted">
      Halaman ini pindah ke{" "}
      <Link href="/docs/mulai-cepat" className="text-accent-strong underline">
        dokumentasi
      </Link>
      .
    </p>
  );
}
