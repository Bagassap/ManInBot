"use client";

import { CheckCircle2, Loader2, LogOut, UserRound } from "lucide-react";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";

export interface PlanView {
  needVerify?: boolean;
  emailReset?: boolean;
}
export interface AccountView {
  email: string;
  name: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  profileComplete: boolean;
}
export interface AccountStatus {
  accountReady: boolean;
  canSaveKey: boolean;
  loggedIn: boolean;
  account: AccountView | null;
  plan: PlanView | null;
}

type Step = "masuk" | "daftar" | "verifikasi" | "lupa" | "reset";

const messageOf = (e: unknown) => (e instanceof Error ? e.message : "Terjadi kesalahan");
const input = "h-10 w-full rounded-xl border border-line bg-transparent px-3 text-sm outline-none focus:border-accent";
const primary =
  "flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-[#0d1417] hover:bg-accent-strong disabled:opacity-50";
const link = "text-xs text-accent-strong underline underline-offset-2 hover:no-underline";

interface Props {
  isAdmin: boolean;
  status: AccountStatus;
  reload: () => Promise<void>;
}

export default function AccountPanel({ isAdmin, status, reload }: Props) {
  const { loggedIn, account, plan } = status;
  const [step, setStep] = useState<Step>("masuk");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState({
    name: account?.name ?? "",
    phone: account?.phone ?? "",
    company: account?.company ?? "",
    jobTitle: account?.jobTitle ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
  const post = (path: string, body: unknown) => api<{ needVerify?: boolean }>(`/settings/account/${path}`, { method: "POST", body: JSON.stringify(body) });
  const submit = (fn: () => Promise<void>) => (e: React.FormEvent) => {
    e.preventDefault();
    void run(fn);
  };

  const afterSignIn = async () => {
    setPassword("");
    setCode("");
    await reload();
  };
  const masuk = submit(async () => {
    await post("login", { email, password });
    await afterSignIn();
  });
  const daftar = submit(async () => {
    const r = await post("register", { email, password });
    if (r.needVerify) {
      setNotice(`Kode verifikasi 6 angka sudah dikirim ke ${email}.`);
      setStep("verifikasi");
      return;
    }
    await afterSignIn();
  });
  const verifikasi = submit(async () => {
    await post("verify", { email, code: code.trim() });
    await afterSignIn();
  });
  const lupa = submit(async () => {
    await post("forgot", { email });
    setNotice("Jika email terdaftar, kode atur ulang sudah dikirim.");
    setStep("reset");
  });
  const reset = submit(async () => {
    await post("reset", { email, code: code.trim(), password });
    setCode("");
    setPassword("");
    setStep("masuk");
    setNotice("Kata sandi diganti. Silakan masuk.");
  });
  const simpanData = submit(async () => {
    await post("profile", {
      name: profile.name.trim(),
      phone: profile.phone.trim(),
      ...(profile.company.trim() ? { company: profile.company.trim() } : {}),
      ...(profile.jobTitle.trim() ? { jobTitle: profile.jobTitle.trim() } : {}),
    });
    setEditing(false);
    await reload();
  });
  const keluar = () => {
    if (!confirm("Keluar dari akun MiB di komputer ini? MiB berhenti bekerja sampai Anda masuk lagi.")) return;
    void run(async () => {
      await api("/settings/account", { method: "DELETE" });
      setStep("masuk");
      await reload();
    });
  };

  const header = (
    <div className="flex items-center gap-2.5">
      <UserRound className="size-5 text-accent-strong" />
      <h2 className="font-medium">Akun MiB</h2>
      {status.accountReady && loggedIn ? (
        <span className="ml-auto flex items-center gap-1 text-xs text-accent-strong">
          <CheckCircle2 className="size-3.5" /> Aktif
        </span>
      ) : (
        <span className="ml-auto text-xs text-muted">{loggedIn ? "Lengkapi data diri" : "Belum masuk"}</span>
      )}
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
  const button = (label: string, disabled = false) => (
    <button disabled={busy || disabled} className={primary}>
      {busy && <Loader2 className="size-4 animate-spin" />}
      {label}
    </button>
  );
  const back = (
    <button type="button" onClick={() => setStep("masuk")} className={link}>
      Kembali
    </button>
  );
  const emailField = <input type="email" required autoComplete="email" placeholder="Email" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />;
  const codeField = (
    <input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required placeholder="Kode 6 angka" aria-label="Kode" value={code} onChange={(e) => setCode(e.target.value)} className={`${input} font-mono tracking-widest`} />
  );

  if (loggedIn && (!account?.profileComplete || editing)) {
    const field = (key: keyof typeof profile, label: string, required: boolean, type = "text", auto = "off") => (
      <input
        type={type}
        required={required}
        maxLength={key === "company" ? 100 : 80}
        autoComplete={auto}
        placeholder={label}
        aria-label={label}
        value={profile[key]}
        onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
        className={input}
      />
    );
    return (
      <section className="rounded-2xl border border-line bg-surface p-5">
        {header}
        <p className="mt-3 text-sm text-muted">{account?.email ? `${account.email}. ` : ""}Lengkapi data diri Anda.</p>
        <form onSubmit={simpanData} className="mt-3 space-y-2">
          {field("name", "Nama lengkap", true, "text", "name")}
          {field("phone", "Nomor HP (contoh: 081234567890)", true, "tel", "tel")}
          {field("company", "Nama kantor atau instansi (opsional)", false, "text", "organization")}
          {field("jobTitle", "Jabatan (opsional)", false, "text", "organization-title")}
          {button("Simpan")}
          {editing ? (
            <button type="button" onClick={() => setEditing(false)} className={link}>
              Batal
            </button>
          ) : (
            <button type="button" onClick={keluar} className={link}>
              Keluar
            </button>
          )}
        </form>
        {messages}
      </section>
    );
  }

  if (loggedIn && account) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-5">
        {header}
        <p className="mt-3 text-sm text-muted">
          Masuk sebagai <span className="text-foreground">{account.name}</span> ({account.email})
        </p>
        {account.company && (
          <p className="mt-1 text-sm text-muted">
            {account.jobTitle ? `${account.jobTitle}, ` : ""}
            {account.company}
          </p>
        )}
        {messages}
        {isAdmin && (
          <div className="mt-4 flex items-center gap-4">
            <button onClick={() => setEditing(true)} className="text-sm text-accent-strong underline underline-offset-2">
              Ubah data diri
            </button>
            <button onClick={keluar} className="flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-red-300">
              <LogOut className="size-4" /> Keluar
            </button>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      {header}
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Daftar atau masuk untuk memakai MiB. Internet hanya dibutuhkan saat ini; pekerjaan Anda tetap offline.
      </p>
      {!isAdmin ? (
        <p className="mt-4 text-sm text-muted">Hanya admin komputer ini yang bisa masuk ke akun MiB.</p>
      ) : (
        <>
          {(step === "masuk" || step === "daftar") && (
            <>
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
              <form onSubmit={step === "masuk" ? masuk : daftar} className="mt-3 space-y-2">
                {emailField}
                <input
                  type="password"
                  required
                  minLength={8}
                  maxLength={100}
                  autoComplete={step === "masuk" ? "current-password" : "new-password"}
                  placeholder={step === "daftar" ? "Kata sandi (min. 8 karakter)" : "Kata sandi"}
                  aria-label="Kata sandi"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={input}
                />
                {button(step === "masuk" ? "Masuk" : plan?.needVerify ? "Daftar dan kirim kode" : "Daftar")}
                {step === "masuk" &&
                  (plan?.emailReset ? (
                    <button type="button" onClick={() => setStep("lupa")} className={link}>
                      Lupa kata sandi?
                    </button>
                  ) : (
                    <p className="text-xs text-muted">Lupa kata sandi? Hubungi admin MiB.</p>
                  ))}
              </form>
            </>
          )}
          {step === "verifikasi" && (
            <form onSubmit={verifikasi} className="mt-4 space-y-2">
              <p className="text-sm text-muted">Masukkan kode yang dikirim ke {email || "email Anda"}.</p>
              {!email && emailField}
              {codeField}
              {button("Verifikasi", code.length !== 6)}
              {back}
            </form>
          )}
          {step === "lupa" && (
            <form onSubmit={lupa} className="mt-4 space-y-2">
              <p className="text-sm text-muted">Masukkan email akun Anda; kode atur ulang akan dikirim.</p>
              {emailField}
              {button("Kirim kode")}
              {back}
            </form>
          )}
          {step === "reset" && (
            <form onSubmit={reset} className="mt-4 space-y-2">
              {codeField}
              <input type="password" required minLength={8} autoComplete="new-password" placeholder="Kata sandi baru (min. 8 karakter)" aria-label="Kata sandi baru" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
              {button("Ganti kata sandi", code.length !== 6)}
              {back}
            </form>
          )}
          {messages}
        </>
      )}
    </section>
  );
}
