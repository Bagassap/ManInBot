"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Script from "@/components/Script";
import { api, API_URL, type User } from "@/lib/api";

const COPY = {
  masuk: {
    title: (
      <>
        Selamat datang <Script>kembali</Script>
      </>
    ),
    subtitle: "Masuk untuk melanjutkan bersama MiB.",
    submit: "Masuk",
    alt: { text: "Belum punya akun?", href: "/daftar", label: "Daftar" },
    path: "/auth/login",
  },
  daftar: {
    title: (
      <>
        Buat <Script>akun</Script> MiB
      </>
    ),
    subtitle: "Mulai bekerja dengan agen AI Anda.",
    submit: "Daftar",
    alt: { text: "Sudah punya akun?", href: "/masuk", label: "Masuk" },
    path: "/auth/register",
  },
} as const;

// Kode galat dari pengalihan backend (/masuk?error=...)
const OAUTH_ERRORS: Record<string, string> = {
  google_off: "Masuk dengan Google belum diaktifkan di server.",
  google_gagal: "Masuk dengan Google gagal. Silakan coba lagi.",
  google_batal: "Masuk dengan Google dibatalkan.",
  akun_diblokir: "Akun ini diblokir. Hubungi admin.",
};

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="size-5 shrink-0">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

const inputClass =
  "w-full rounded-xl border border-line bg-background/60 px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted/60 focus:border-accent";

const item = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export default function AuthForm({ mode }: { mode: "masuk" | "daftar" }) {
  const copy = COPY[mode];
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const urlError = OAUTH_ERRORS[useSearchParams().get("error") ?? ""] ?? "";

  // Sudah login? langsung ke aplikasi.
  useEffect(() => {
    api<User>("/auth/me")
      .then(() => router.replace("/app"))
      .catch(() => {});
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api<User>(copy.path, {
        method: "POST",
        body: JSON.stringify(
          mode === "daftar"
            ? { email, password, name: name || undefined }
            : { email, password },
        ),
      });
      router.replace("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.97, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="fx-shimmer w-full max-w-sm rounded-2xl border border-line bg-surface/70 p-7 backdrop-blur-md"
    >
      <Link href="/" className="flex items-center justify-center gap-2.5">
        <Image
          src="/asset/logo-mark-v2.png"
          alt=""
          width={32}
          height={36}
          className="shrink-0"
        />
        <span className="font-display text-xl font-semibold tracking-tight">
          MiB
        </span>
      </Link>
      <h1 className="mt-6 text-balance text-center text-2xl font-semibold tracking-tight">
        {copy.title}
      </h1>
      <p className="mt-1 text-balance text-center text-sm text-muted">
        {copy.subtitle}
      </p>

      {/* Google hanya di versi server; aplikasi desktop (satu asal, API_URL kosong) memakai email saja */}
      {API_URL !== "" && (
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="mt-6"
      >
        <a
          href={`${API_URL}/auth/google`}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-[#131314] py-3 text-sm font-medium text-[#e3e3e3] transition-colors hover:border-accent/50 hover:bg-[#1c1c1e]"
        >
          <GoogleLogo />
          {mode === "masuk" ? "Masuk dengan Google" : "Daftar dengan Google"}
        </a>
        <div className="mt-5 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" />
          atau dengan email
          <span className="h-px flex-1 bg-line" />
        </div>
      </motion.div>
      )}

      <motion.form
        onSubmit={onSubmit}
        className="mt-5 space-y-3"
        initial="hidden"
        animate="show"
        variants={{
          show: { transition: { staggerChildren: 0.09, delayChildren: 0.25 } },
        }}
      >
        {mode === "daftar" && (
          <motion.input
            variants={item}
            className={inputClass}
            placeholder="Nama (opsional)"
            autoComplete="name"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <motion.input
          variants={item}
          className={inputClass}
          type="email"
          placeholder="Email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <motion.input
          variants={item}
          className={inputClass}
          type="password"
          placeholder={
            mode === "daftar" ? "Kata sandi (min. 8 karakter)" : "Kata sandi"
          }
          autoComplete={mode === "daftar" ? "new-password" : "current-password"}
          required
          minLength={mode === "daftar" ? 8 : undefined}
          maxLength={128}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {(error || urlError) && (
          <p
            role="alert"
            className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-300"
          >
            {error || urlError}
          </p>
        )}
        <motion.button
          variants={item}
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-accent py-3 text-sm font-medium text-[#0d1417] transition-colors hover:bg-accent-strong disabled:opacity-60"
        >
          {loading ? "Memproses…" : copy.submit}
        </motion.button>
      </motion.form>

      <p className="mt-5 text-center text-sm text-muted">
        {copy.alt.text}{" "}
        <Link
          href={copy.alt.href}
          className="font-medium text-accent-strong hover:underline"
        >
          {copy.alt.label}
        </Link>
      </p>
    </motion.div>
  );
}
