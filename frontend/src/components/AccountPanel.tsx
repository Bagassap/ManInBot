"use client";

import { CheckCircle2, ExternalLink, Loader2, LogOut, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";

export interface PlanView {
  freePerDay: number;
  paidPerDay: number;
  days: number;
  priceIdr: number;
  canPay: boolean;
}
export interface AccountView {
  email: string;
  paid: boolean;
  paidUntil: string | null;
  usedToday: number;
  limitToday: number;
  plan: PlanView;
}

type Step = "masuk" | "daftar" | "verifikasi" | "lupa" | "reset";

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;
const messageOf = (e: unknown) => (e instanceof Error ? e.message : "Terjadi kesalahan");

const input =
  "h-10 w-full rounded-xl border border-line bg-transparent px-3 text-sm outline-none focus:border-accent";
const primary =
  "flex h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-[#0d1417] hover:bg-accent-strong disabled:opacity-50";
const link = "text-accent-strong underline underline-offset-2 hover:no-underline";

interface Props {
  isAdmin: boolean;
  loggedIn: boolean;
  account: AccountView | null;
  problem: string | null;
  plan: PlanView | null;
  canSave: boolean;
  reload: () => Promise<void>;
}

export default function AccountPanel({ isAdmin, loggedIn, account, problem, plan, canSave, reload }: Props) {
  const [step, setStep] = useState<Step>("masuk");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [paying, setPaying] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => void (poll.current && clearInterval(poll.current)), []);
  // Berhenti memantau pembayaran begitu paket berbayar aktif.
  useEffect(() => {
    if (account?.paid && poll.current) {
      clearInterval(poll.current);
      poll.current = null;
      setPaying(false);
      setNotice("Pembayaran berhasil. Akses penuh sudah aktif.");
    }
  }, [account?.paid]);

  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(messageOf(e));
      if (e instanceof ApiError && (e.body as { needVerify?: boolean } | null)?.needVerify) setStep("verifikasi");
    } finally {
      setBusy(false);
    }
  }

  const submitMasuk = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api("/settings/account/login", { method: "POST", body: JSON.stringify({ email, password }) });
      setPassword("");
      await reload();
    });
  };
  const submitDaftar = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api("/settings/account/register", { method: "POST", body: JSON.stringify({ email, password }) });
      setNotice(`Kode verifikasi 6 angka sudah dikirim ke ${email}.`);
      setStep("verifikasi");
    });
  };
  const submitVerifikasi = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api("/settings/account/verify", { method: "POST", body: JSON.stringify({ email, code: code.trim() }) });
      setCode("");
      setPassword("");
      await reload();
    });
  };
  const submitLupa = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api("/settings/account/forgot", { method: "POST", body: JSON.stringify({ email }) });
      setNotice("Jika email terdaftar, kode atur ulang sudah dikirim.");
      setStep("reset");
    });
  };
  const submitReset = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api("/settings/account/reset", { method: "POST", body: JSON.stringify({ email, code: code.trim(), password }) });
      setCode("");
      setPassword("");
      setStep("masuk");
      setNotice("Kata sandi diganti. Silakan masuk.");
    });
  };

  async function upgrade() {
    await run(async () => {
      const r = await api<{ url: string }>("/settings/account/checkout", { method: "POST", body: JSON.stringify({}) });
      window.open(r.url, "_blank", "noopener");
      setPaying(true);
      setNotice("Halaman pembayaran dibuka di browser. Setelah bayar, status di sini diperbarui otomatis.");
      // Pantau status ±5 menit; webhook pembayaran biasanya tiba dalam hitungan detik.
      if (poll.current) clearInterval(poll.current);
      let n = 0;
      poll.current = setInterval(() => {
        void reload();
        if (++n >= 60 && poll.current) {
          clearInterval(poll.current);
          poll.current = null;
          setPaying(false);
        }
      }, 5000);
    });
  }

  async function logout() {
    if (!confirm("Keluar dari akun MiB di komputer ini? MiB berhenti bekerja sampai Anda masuk lagi.")) return;
    await run(async () => {
      await api("/settings/account", { method: "DELETE" });
      await reload();
    });
  }

  const header = (
    <div className="flex items-center gap-2.5">
      <UserRound className="size-5 text-accent-strong" />
      <h2 className="font-medium">Akun MiB</h2>
      <span
        className={`ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${account?.paid ? "bg-emerald-400/15 text-emerald-300" : account ? "bg-accent/15 text-accent-strong" : "bg-amber-400/15 text-amber-200"}`}
      >
        {account?.paid ? (
          <>
            <CheckCircle2 className="size-3.5" /> Berbayar
          </>
        ) : account ? (
          "Gratis"
        ) : (
          "Belum masuk"
        )}
      </span>
    </div>
  );

  const messages = (error || notice) && (
    <p
      role={error ? "alert" : "status"}
      className={`mt-3 rounded-xl border px-3 py-2 text-sm ${error ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-accent/30 bg-accent/10 text-accent-strong"}`}
    >
      {error || notice}
    </p>
  );

  // ---------- sudah masuk ----------
  if (loggedIn && account) {
    const pct = Math.min(100, (account.usedToday / Math.max(1, account.limitToday)) * 100);
    const full = account.usedToday >= account.limitToday;
    return (
      <section className="rounded-2xl border border-line bg-surface p-5">
        {header}
        <p className="mt-3 text-sm text-muted">
          Masuk sebagai <span className="text-foreground">{account.email}</span>
        </p>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted">
            <span>
              Perintah hari ini: {account.usedToday} dari {account.limitToday}
            </span>
            <span>{account.paid && account.paidUntil ? `Berlaku s.d. ${new Date(account.paidUntil).toLocaleDateString("id-ID")}` : "Diperbarui 00.00 WIB"}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
            <div className={`h-full rounded-full ${full ? "bg-amber-400" : "bg-accent"}`} style={{ width: `${pct}%` }} />
          </div>
        </div>

        {!account.paid && (
          <div className="mt-4 rounded-xl border border-line p-4 text-sm">
            <p className="font-medium">Akses penuh</p>
            <p className="mt-1 text-muted">
              Paket gratis dibatasi {account.plan.freePerDay} perintah per hari.
              {account.plan.canPay
                ? ` Paket berbayar: ${account.plan.paidPerDay} perintah per hari selama ${account.plan.days} hari, ${rupiah(account.plan.priceIdr)}.`
                : " Pembayaran belum dibuka."}
            </p>
            {account.plan.canPay && isAdmin && (
              <button onClick={() => void upgrade()} disabled={busy} className={`${primary} mt-3`}>
                {busy || paying ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
                {paying ? "Menunggu pembayaran…" : "Bayar & aktifkan"}
              </button>
            )}
          </div>
        )}
        {account.paid && account.plan.canPay && isAdmin && (
          <button onClick={() => void upgrade()} disabled={busy} className="mt-4 text-sm text-accent-strong underline underline-offset-2">
            Perpanjang {account.plan.days} hari ({rupiah(account.plan.priceIdr)})
          </button>
        )}
        {messages}
        {isAdmin && (
          <button onClick={() => void logout()} className="mt-4 flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-red-300">
            <LogOut className="size-4" /> Keluar dari akun
          </button>
        )}
      </section>
    );
  }

  // ---------- belum masuk ----------
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      {header}
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Masuk ke akun MiB untuk mengaktifkan agen. Gratis {plan?.freePerDay ?? 3} perintah per hari
        {plan?.canPay ? `, atau ${plan.paidPerDay} perintah per hari dengan paket berbayar (${rupiah(plan.priceIdr)} / ${plan.days} hari)` : ""}
        . Layanan AI sudah termasuk; tidak ada kunci yang perlu Anda siapkan.
      </p>
      {problem && <p className="mt-3 text-sm text-amber-200">{problem}</p>}

      {!isAdmin ? (
        <p className="mt-4 text-sm text-muted">Hanya admin komputer ini yang bisa masuk ke akun MiB.</p>
      ) : !canSave ? (
        <p className="mt-4 text-sm text-muted">Masuk akun hanya tersedia pada aplikasi terpasang.</p>
      ) : (
        <>
          {(step === "masuk" || step === "daftar") && (
            <div className="mt-4 flex gap-1 rounded-xl border border-line p-1 text-sm">
              {(["masuk", "daftar"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setStep(s);
                    setError("");
                    setNotice("");
                  }}
                  className={`h-8 flex-1 rounded-lg transition-colors ${step === s ? "bg-accent/15 text-accent-strong" : "text-muted hover:text-foreground"}`}
                >
                  {s === "masuk" ? "Masuk" : "Daftar"}
                </button>
              ))}
            </div>
          )}

          {(step === "masuk" || step === "daftar") && (
            <form onSubmit={step === "masuk" ? submitMasuk : submitDaftar} className="mt-3 space-y-2">
              <input type="email" required autoComplete="email" placeholder="Email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
              <input
                type="password"
                required
                minLength={8}
                autoComplete={step === "masuk" ? "current-password" : "new-password"}
                placeholder={step === "daftar" ? "Kata sandi (min. 8 karakter)" : "Kata sandi"}
                aria-label="Kata sandi"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={input}
              />
              <button disabled={busy} className={`${primary} w-full`}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {step === "masuk" ? "Masuk" : "Daftar dan kirim kode"}
              </button>
              {step === "masuk" && (
                <button type="button" onClick={() => setStep("lupa")} className={`${link} text-xs`}>
                  Lupa kata sandi?
                </button>
              )}
            </form>
          )}

          {step === "verifikasi" && (
            <form onSubmit={submitVerifikasi} className="mt-4 space-y-2">
              <p className="text-sm text-muted">Masukkan kode 6 angka yang dikirim ke {email || "email Anda"}.</p>
              {!email && <input type="email" required placeholder="Email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />}
              <input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required placeholder="000000" aria-label="Kode verifikasi" value={code} onChange={(e) => setCode(e.target.value)} className={`${input} font-mono tracking-widest`} />
              <button disabled={busy || code.length !== 6} className={`${primary} w-full`}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Verifikasi
              </button>
              <button type="button" onClick={() => setStep("masuk")} className={`${link} text-xs`}>
                Kembali
              </button>
            </form>
          )}

          {step === "lupa" && (
            <form onSubmit={submitLupa} className="mt-4 space-y-2">
              <p className="text-sm text-muted">Masukkan email akun Anda; kode atur ulang akan dikirim.</p>
              <input type="email" required placeholder="Email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
              <button disabled={busy} className={`${primary} w-full`}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Kirim kode
              </button>
              <button type="button" onClick={() => setStep("masuk")} className={`${link} text-xs`}>
                Kembali
              </button>
            </form>
          )}

          {step === "reset" && (
            <form onSubmit={submitReset} className="mt-4 space-y-2">
              <input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required placeholder="Kode 6 angka" aria-label="Kode" value={code} onChange={(e) => setCode(e.target.value)} className={`${input} font-mono tracking-widest`} />
              <input type="password" required minLength={8} autoComplete="new-password" placeholder="Kata sandi baru (min. 8 karakter)" aria-label="Kata sandi baru" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
              <button disabled={busy || code.length !== 6} className={`${primary} w-full`}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Ganti kata sandi
              </button>
              <button type="button" onClick={() => setStep("masuk")} className={`${link} text-xs`}>
                Kembali
              </button>
            </form>
          )}
          {messages}
        </>
      )}
    </section>
  );
}
