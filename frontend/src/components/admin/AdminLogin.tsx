"use client";

import { motion } from "framer-motion";
import { Eye, EyeOff, LogIn, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, type User } from "@/lib/api";

const field =
  "h-12 w-full rounded-2xl border border-line bg-surface px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent";

/** Halaman masuk khusus admin: tema terang, sama dengan dashboard admin. */
export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notAdmin, setNotAdmin] = useState<User | null>(null);

  // Sudah masuk sebagai admin? Langsung ke dashboard.
  useEffect(() => {
    api<User>("/auth/me")
      .then((u) => u.role === "ADMIN" && router.replace("/admin"))
      .catch(() => {});
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotAdmin(null);
    try {
      const user = await api<User>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (user.role === "ADMIN") {
        router.replace("/admin");
        return;
      }
      setNotAdmin(user);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Tidak dapat terhubung ke server. Pastikan backend berjalan di port 4000, lalu coba lagi.",
      );
    }
    setBusy(false);
  }

  return (
    <div className="admin flex min-h-dvh items-center justify-center px-5 py-12">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md rounded-[28px] border border-white/70 bg-white p-7 shadow-[0_30px_80px_-40px_rgba(60,50,160,0.4)] sm:p-9"
      >
        <Link
          href="/"
          className="flex items-center justify-center gap-2.5"
          aria-label="MiB"
        >
          <Image
            src="/asset/logo-mark-v2.png"
            alt=""
            width={32}
            height={36}
            className="shrink-0"
            priority
          />
          <span className="leading-tight">
            <span className="block font-display text-xl font-semibold tracking-tight">
              MiB
            </span>
            <span className="block text-[10px] text-muted">
              Pusat kendali agen
            </span>
          </span>
        </Link>

        <div className="mt-7 flex items-center justify-center gap-2 text-xs font-medium text-accent-strong">
          <ShieldCheck className="size-4" />
          Area khusus admin
        </div>
        <h1 className="mt-2 text-balance text-center text-2xl font-semibold tracking-tight">
          Masuk ke dashboard
        </h1>
        <p className="mt-1 text-center text-sm text-muted">
          Pantau dan kelola layanan agen AI MiB.
        </p>

        <form onSubmit={onSubmit} className="mt-7 space-y-3">
          <label className="block">
            <span className="sr-only">Email</span>
            <input
              className={field}
              type="email"
              placeholder="Email admin"
              autoComplete="email"
              autoFocus
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="relative block">
            <span className="sr-only">Kata sandi</span>
            <input
              className={`${field} pr-12`}
              type={show ? "text" : "password"}
              placeholder="Kata sandi"
              autoComplete="current-password"
              required
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={
                show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
              }
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-foreground"
            >
              {show ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-rose-500/25 bg-rose-500/8 px-3.5 py-2.5 text-center text-sm text-rose-600"
            >
              {error}
            </p>
          )}
          {notAdmin && (
            <div
              role="alert"
              className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-center text-sm text-amber-800"
            >
              Akun <b>{notAdmin.email}</b> berhasil masuk, tetapi bukan admin.
              <Link
                href="/app"
                className="mt-1 block font-medium text-accent-strong hover:underline"
              >
                Lanjut ke chat
              </Link>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-sm font-medium text-white shadow-lg shadow-accent/30 transition-colors hover:bg-accent-strong disabled:opacity-60"
          >
            <LogIn className="size-4" />
            {busy ? "Memproses…" : "Masuk"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs leading-relaxed text-muted">
          Akun Google? Masuk lewat{" "}
          <Link
            href="/masuk"
            className="font-medium text-accent-strong hover:underline"
          >
            halaman pengguna
          </Link>
          , lalu buka <span className="font-mono">/admin</span>.
        </p>
      </motion.div>
    </div>
  );
}
