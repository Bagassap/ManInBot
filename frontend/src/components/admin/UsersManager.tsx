"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Ban,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Unlock,
  UserPlus,
  Activity,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Modal from "./Modal";
import { ApiError } from "@/lib/api";
import {
  adminApi,
  AUDIT_LABEL,
  fmtAgo,
  fmtCompact,
  fmtInt,
  initials,
  randomPassword,
  type AdminUser,
  type AuditEntry,
} from "@/lib/admin-api";
import { useFetch } from "@/lib/use-fetch";

type Dialog =
  | { type: "create" }
  | {
      type:
        | "rename"
        | "reset"
        | "delete"
        | "block"
        | "unblock"
        | "role"
        | "sessions";
      user: AdminUser;
    }
  | null;

const field =
  "h-11 w-full rounded-2xl border border-line bg-surface px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent";
const btnPrimary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-accent px-5 text-sm font-medium text-white shadow-lg shadow-accent/25 transition-colors hover:bg-accent-strong disabled:opacity-50";
const btnGhost =
  "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-5 text-sm font-medium transition-colors hover:border-accent/40";

const errMsg = (e: unknown) =>
  e instanceof ApiError || e instanceof Error ? e.message : "Terjadi kesalahan";

/* ---------- isian kata sandi dengan pembuat acak ---------- */
function PasswordField({
  value,
  onChange,
  label = "Kata sandi",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">
        {label}
      </span>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            className={`${field} pr-11 font-mono`}
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            minLength={8}
            maxLength={128}
            required
            autoComplete="new-password"
            placeholder="Minimal 8 karakter"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={
              show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
            }
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(randomPassword());
            setShow(true);
          }}
          className={`${btnGhost} px-3.5`}
          title="Buat kata sandi acak"
        >
          <RefreshCw className="size-4" />
          Acak
        </button>
      </div>
    </label>
  );
}

function ErrorLine({ msg }: { msg: string }) {
  return msg ? (
    <p
      role="alert"
      className="rounded-xl border border-rose-500/25 bg-rose-500/8 px-3 py-2 text-sm text-rose-600"
    >
      {msg}
    </p>
  ) : null;
}

/* ---------- dialog ---------- */
function DialogBody({
  dialog,
  onClose,
  onDone,
}: {
  dialog: Exclude<Dialog, null>;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState(
    dialog.type === "rename" ? (dialog.user.name ?? "") : "",
  );
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"USER" | "ADMIN">("USER");
  const [confirmText, setConfirmText] = useState("");

  async function submit(
    e: React.FormEvent,
    fn: () => Promise<unknown>,
    doneMsg: string,
  ) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await fn();
      onDone(doneMsg);
      onClose();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  if (dialog.type === "create") {
    return (
      <form
        className="space-y-4"
        onSubmit={(e) =>
          submit(
            e,
            () =>
              adminApi.createUser({
                email,
                password,
                role,
                name: name.trim() || undefined,
              }),
            `Akun ${email} dibuat`,
          )
        }
      >
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">
            Email
          </span>
          <input
            className={field}
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            placeholder="nama@perusahaan.com"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">
            Nama (opsional)
          </span>
          <input
            className={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
          />
        </label>
        <PasswordField
          value={password}
          onChange={setPassword}
          label="Kata sandi awal"
        />
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">
            Peran
          </span>
          <select
            className={field}
            value={role}
            onChange={(e) => setRole(e.target.value as "USER" | "ADMIN")}
          >
            <option value="USER">Pengguna</option>
            <option value="ADMIN">Admin (akses penuh dashboard ini)</option>
          </select>
        </label>
        <ErrorLine msg={error} />
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnGhost} onClick={onClose}>
            Batal
          </button>
          <button className={btnPrimary} disabled={busy}>
            <UserPlus className="size-4" />
            {busy ? "Membuat…" : "Buat akun"}
          </button>
        </div>
      </form>
    );
  }

  const u = dialog.user;
  const who = u.name || u.email;

  if (dialog.type === "rename") {
    return (
      <form
        className="space-y-4"
        onSubmit={(e) =>
          submit(
            e,
            () => adminApi.updateUser(u.id, { name }),
            "Nama diperbarui",
          )
        }
      >
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">
            Nama untuk {u.email}
          </span>
          <input
            className={field}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
          />
        </label>
        <ErrorLine msg={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>
            Batal
          </button>
          <button className={btnPrimary} disabled={busy}>
            Simpan
          </button>
        </div>
      </form>
    );
  }

  if (dialog.type === "reset") {
    return (
      <form
        className="space-y-4"
        onSubmit={(e) =>
          submit(
            e,
            () => adminApi.resetPassword(u.id, password),
            `Kata sandi ${who} direset`,
          )
        }
      >
        <p className="text-sm text-muted">
          Atur kata sandi baru untuk <b className="text-foreground">{who}</b>.
          Semua sesi aktifnya langsung berakhir. Sampaikan kata sandi ini kepada
          pengguna lewat jalur yang aman.
        </p>
        {!u.hasPassword && (
          <p className="rounded-xl bg-accent/8 px-3 py-2 text-xs text-accent-strong">
            Akun ini sebelumnya hanya masuk lewat Google. Setelah ini ia juga
            bisa masuk dengan email dan kata sandi.
          </p>
        )}
        <PasswordField
          value={password}
          onChange={setPassword}
          label="Kata sandi baru"
        />
        <ErrorLine msg={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>
            Batal
          </button>
          <button className={btnPrimary} disabled={busy}>
            <KeyRound className="size-4" />
            {busy ? "Menyimpan…" : "Reset kata sandi"}
          </button>
        </div>
      </form>
    );
  }

  // dialog konfirmasi
  const confirms = {
    block: {
      text: `${who} tidak akan bisa masuk atau memakai agen, dan sesi yang sedang berjalan langsung diputus. Datanya tetap tersimpan, dan blokir bisa dibuka kapan saja.`,
      label: "Blokir akun",
      danger: true,
      run: () => adminApi.updateUser(u.id, { blocked: true }),
      done: `${who} diblokir`,
    },
    unblock: {
      text: `${who} akan bisa masuk dan memakai agen lagi.`,
      label: "Buka blokir",
      danger: false,
      run: () => adminApi.updateUser(u.id, { blocked: false }),
      done: `Blokir ${who} dibuka`,
    },
    role: {
      text:
        u.role === "ADMIN"
          ? `${who} tidak lagi bisa membuka dashboard admin dan mengelola pengguna.`
          : `${who} akan bisa melihat semua pengguna dan percakapannya, serta mengelola akun. Berikan hanya kepada orang yang dipercaya.`,
      label: u.role === "ADMIN" ? "Cabut hak admin" : "Jadikan admin",
      danger: u.role !== "ADMIN",
      run: () =>
        adminApi.updateUser(u.id, {
          role: u.role === "ADMIN" ? "USER" : "ADMIN",
        }),
      done:
        u.role === "ADMIN" ? `Hak admin ${who} dicabut` : `${who} kini admin`,
    },
    sessions: {
      text: `${who} akan keluar dari semua perangkat dan harus masuk lagi.`,
      label: "Akhiri semua sesi",
      danger: false,
      run: () => adminApi.revokeSessions(u.id),
      done: `Sesi ${who} diakhiri`,
    },
    delete: {
      text: `Menghapus ${who} beserta SEMUA percakapan dan catatan agennya secara permanen. Tindakan ini tidak bisa dibatalkan. Untuk menutup akses tanpa menghapus data, gunakan Blokir.`,
      label: "Hapus permanen",
      danger: true,
      run: () => adminApi.deleteUser(u.id),
      done: `${who} dihapus`,
    },
  }[dialog.type];

  const needType = dialog.type === "delete";
  const ok =
    !needType || confirmText.trim().toLowerCase() === u.email.toLowerCase();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => ok && submit(e, confirms.run, confirms.done)}
    >
      <p className="text-sm leading-relaxed text-muted">{confirms.text}</p>
      {needType && (
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">
            Ketik <b className="text-foreground">{u.email}</b> untuk memastikan
          </span>
          <input
            className={field}
            autoFocus
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
          />
        </label>
      )}
      <ErrorLine msg={error} />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className={btnGhost}
          onClick={onClose}
          autoFocus={!needType}
        >
          Batal
        </button>
        <button
          className={`inline-flex h-11 items-center justify-center rounded-2xl px-5 text-sm font-medium text-white transition-colors disabled:opacity-50 ${confirms.danger ? "bg-rose-600 hover:bg-rose-700" : "bg-accent hover:bg-accent-strong"}`}
          disabled={busy || !ok}
        >
          {busy ? "Memproses…" : confirms.label}
        </button>
      </div>
    </form>
  );
}

const DIALOG_TITLE: Record<string, string> = {
  create: "Tambah pengguna",
  rename: "Ubah nama",
  reset: "Reset kata sandi",
  delete: "Hapus pengguna",
  block: "Blokir pengguna",
  unblock: "Buka blokir",
  role: "Ubah peran",
  sessions: "Akhiri semua sesi",
};

/* ---------- menu aksi ---------- */
interface MenuState {
  user: AdminUser;
  x: number;
  y: number;
}

function ActionMenu({
  menu,
  isSelf,
  onClose,
  onDialog,
  onViewRuns,
}: {
  menu: MenuState;
  isSelf: boolean;
  onClose: () => void;
  onDialog: (d: Exclude<Dialog, null>) => void;
  onViewRuns: (id: string) => void;
}) {
  const u = menu.user;

  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [onClose]);

  type Item = {
    label: string;
    icon: ReactNode;
    onClick: () => void;
    danger?: boolean;
    hidden?: boolean;
  };
  const items: Item[] = [
    {
      label: "Lihat perintah",
      icon: <Activity className="size-4" />,
      onClick: () => onViewRuns(u.id),
    },
    {
      label: "Ubah nama",
      icon: <Pencil className="size-4" />,
      onClick: () => onDialog({ type: "rename", user: u }),
    },
    {
      label: u.role === "ADMIN" ? "Cabut hak admin" : "Jadikan admin",
      icon:
        u.role === "ADMIN" ? (
          <ShieldOff className="size-4" />
        ) : (
          <ShieldCheck className="size-4" />
        ),
      onClick: () => onDialog({ type: "role", user: u }),
      hidden: isSelf,
    },
    {
      label: "Reset kata sandi",
      icon: <KeyRound className="size-4" />,
      onClick: () => onDialog({ type: "reset", user: u }),
      hidden: isSelf,
    },
    {
      label: "Akhiri semua sesi",
      icon: <LogOut className="size-4" />,
      onClick: () => onDialog({ type: "sessions", user: u }),
      hidden: isSelf,
    },
    {
      label: u.blocked ? "Buka blokir" : "Blokir akun",
      icon: u.blocked ? (
        <Unlock className="size-4" />
      ) : (
        <Ban className="size-4" />
      ),
      onClick: () =>
        onDialog({ type: u.blocked ? "unblock" : "block", user: u }),
      danger: !u.blocked,
      hidden: isSelf,
    },
    {
      label: "Hapus pengguna",
      icon: <Trash2 className="size-4" />,
      onClick: () => onDialog({ type: "delete", user: u }),
      danger: true,
      hidden: isSelf,
    },
  ];

  return (
    <motion.div
      role="menu"
      aria-label={`Aksi untuk ${u.email}`}
      onMouseDown={(e) => e.stopPropagation()}
      style={{ position: "fixed", left: menu.x, top: menu.y }}
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.14 }}
      className="z-40 w-56 origin-top-right rounded-2xl border border-line bg-surface p-1.5 shadow-2xl shadow-[#14142b]/20"
    >
      {items
        .filter((i) => !i.hidden)
        .map((i) => (
          <button
            key={i.label}
            role="menuitem"
            onClick={() => {
              onClose();
              i.onClick();
            }}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${i.danger ? "text-rose-600 hover:bg-rose-500/8" : "hover:bg-foreground/6"}`}
          >
            {i.icon}
            {i.label}
          </button>
        ))}
      {isSelf && (
        <p className="px-3 py-2 text-[11px] text-muted">
          Ini akun Anda. Peran, blokir, dan penghapusan dikunci demi keamanan.
        </p>
      )}
    </motion.div>
  );
}

/**
 * Dialog, menu, dan notifikasi dirender di <body>. Kontainer dashboard memakai backdrop-blur, yang membuat
 * elemen "fixed" di dalamnya berpatokan pada kontainer (bukan layar), sehingga dialog bisa jatuh di luar layar.
 */
function Portal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="admin-vars">{children}</div>,
    document.body,
  );
}

const MENU_W = 224;
const MENU_H = 330;

/* ---------- riwayat tindakan ---------- */
function AuditList({ tick }: { tick: number }) {
  const audit = useFetch<AuditEntry[]>(`audit:${tick}`, () => adminApi.audit());
  const rows = audit.data ?? [];
  return (
    <section
      aria-label="Riwayat tindakan admin"
      className="mt-5 rounded-3xl border border-line bg-surface p-5"
    >
      <h2 className="text-base font-semibold">Riwayat tindakan admin</h2>
      <p className="mt-0.5 text-xs text-muted">
        Setiap perubahan pada akun tercatat di sini dan tidak bisa diubah.
      </p>
      <ul className="mt-4 divide-y divide-line">
        {rows.length === 0 && (
          <li className="py-6 text-center text-sm text-muted">
            {audit.loading ? "Memuat…" : "Belum ada tindakan."}
          </li>
        )}
        {rows.map((a) => (
          <li key={a.id} className="flex items-start gap-3 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/12 text-[11px] font-semibold text-accent-strong">
              {initials({ name: null, email: a.actorEmail })}
            </span>
            <p className="min-w-0 flex-1 text-sm leading-snug">
              <b className="font-medium">{a.actorEmail}</b>{" "}
              {AUDIT_LABEL[a.action] ?? a.action}
              {a.targetEmail && (
                <>
                  {" "}
                  <b className="font-medium">{a.targetEmail}</b>
                </>
              )}
              {a.detail && <span className="text-muted"> · {a.detail}</span>}
            </p>
            <span className="shrink-0 text-xs text-muted">
              {fmtAgo(a.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- komponen utama ---------- */
export default function UsersManager({
  users,
  loading,
  meId,
  tick,
  onViewRuns,
  onChanged,
}: {
  users: AdminUser[] | null;
  loading: boolean;
  meId: string;
  tick: number;
  onViewRuns: (id: string) => void;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [roleF, setRoleF] = useState<"ALL" | "USER" | "ADMIN">("ALL");
  const [statusF, setStatusF] = useState<"ALL" | "ACTIVE" | "BLOCKED">("ALL");
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users ?? []).filter(
      (u) =>
        (roleF === "ALL" || u.role === roleF) &&
        (statusF === "ALL" || (statusF === "BLOCKED") === u.blocked) &&
        (!q ||
          u.email.toLowerCase().includes(q) ||
          (u.name ?? "").toLowerCase().includes(q)),
    );
  }, [users, query, roleF, statusF]);

  const total = users?.length ?? 0;
  const admins = (users ?? []).filter((u) => u.role === "ADMIN").length;
  const blocked = (users ?? []).filter((u) => u.blocked).length;

  function openMenu(e: React.MouseEvent<HTMLButtonElement>, user: AdminUser) {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const up = r.bottom + MENU_H + 12 > window.innerHeight;
    setMenu({
      user,
      x: Math.max(
        8,
        Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8),
      ),
      // dijepit agar selalu berada di dalam layar, apa pun posisi tombolnya
      y: Math.max(
        8,
        Math.min(
          up ? r.top - MENU_H - 6 : r.bottom + 6,
          window.innerHeight - MENU_H - 8,
        ),
      ),
    });
  }

  return (
    <>
      {/* ringkasan + alat */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            { l: "Total", v: total },
            { l: "Admin", v: admins },
            { l: "Diblokir", v: blocked },
          ].map((c) => (
            <span
              key={c.l}
              className="rounded-2xl border border-line bg-surface px-3.5 py-2"
            >
              <b className="tabular-nums">{fmtInt(c.v)}</b>{" "}
              <span className="text-muted">{c.l}</span>
            </span>
          ))}
        </div>
        <button
          className={`${btnPrimary} ml-auto`}
          onClick={() => setDialog({ type: "create" })}
        >
          <Plus className="size-4" /> Tambah pengguna
        </button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="relative">
          <span className="sr-only">Cari pengguna</span>
          <input
            className={`${field} pr-10`}
            placeholder="Cari nama atau email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={100}
          />
          <Search className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        </label>
        <select
          aria-label="Filter peran"
          className={`${field} sm:w-44`}
          value={roleF}
          onChange={(e) => setRoleF(e.target.value as typeof roleF)}
        >
          <option value="ALL">Semua peran</option>
          <option value="USER">Pengguna</option>
          <option value="ADMIN">Admin</option>
        </select>
        <select
          aria-label="Filter status"
          className={`${field} sm:w-44`}
          value={statusF}
          onChange={(e) => setStatusF(e.target.value as typeof statusF)}
        >
          <option value="ALL">Semua status</option>
          <option value="ACTIVE">Aktif</option>
          <option value="BLOCKED">Diblokir</option>
        </select>
      </div>

      <section
        aria-label="Pengguna"
        className="overflow-hidden rounded-3xl border border-line bg-surface"
      >
        <div
          className={`overflow-x-auto transition-opacity ${loading ? "opacity-60" : ""}`}
        >
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-5 py-3.5 font-medium">Pengguna</th>
                <th className="px-3 py-3.5 font-medium">Peran</th>
                <th className="px-3 py-3.5 font-medium">Status</th>
                <th className="px-3 py-3.5 text-right font-medium">Perintah</th>
                <th className="px-3 py-3.5 text-right font-medium">Gagal</th>
                <th className="px-3 py-3.5 text-right font-medium">Token</th>
                <th className="px-3 py-3.5 font-medium">Aktif terakhir</th>
                <th className="w-14 px-3 py-3.5">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((u, i) => {
                const self = u.id === meId;
                return (
                  <motion.tr
                    key={u.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.3,
                      delay: Math.min(i, 10) * 0.025,
                    }}
                    className={`border-t border-line transition-colors hover:bg-accent/4 ${u.blocked ? "bg-rose-500/[0.03]" : ""}`}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${u.blocked ? "bg-rose-500/10 text-rose-600" : "bg-accent/12 text-accent-strong"}`}
                        >
                          {initials(u)}
                        </span>
                        <div className="min-w-0">
                          <button
                            onClick={() => onViewRuns(u.id)}
                            title="Lihat perintah pengguna ini"
                            className="block max-w-[260px] truncate text-left font-medium hover:text-accent-strong"
                          >
                            {u.name || u.email}
                            {self && (
                              <span className="ml-2 rounded-md bg-foreground/8 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                                Anda
                              </span>
                            )}
                          </button>
                          <p className="flex items-center gap-1.5 truncate text-xs text-muted">
                            {u.email}
                            {u.hasGoogle && (
                              <span className="rounded bg-sky-500/10 px-1 py-px text-[10px] text-sky-600">
                                Google
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${u.role === "ADMIN" ? "bg-accent/15 text-accent-strong" : "bg-foreground/8 text-muted"}`}
                      >
                        {u.role === "ADMIN" ? "Admin" : "Pengguna"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {u.blocked ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600">
                          <Ban className="size-3.5" /> Diblokir
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                          <CheckCircle2 className="size-3.5" /> Aktif
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {fmtInt(u.runs)}
                    </td>
                    <td
                      className={`px-3 py-3 text-right tabular-nums ${u.errors ? "font-medium text-rose-600" : "text-muted"}`}
                    >
                      {fmtInt(u.errors)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {fmtCompact(u.tokens)}
                    </td>
                    <td className="px-3 py-3 text-muted">
                      {u.lastRunAt ? fmtAgo(u.lastRunAt) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={(e) => openMenu(e, u)}
                        aria-label={`Aksi untuk ${u.email}`}
                        aria-haspopup="menu"
                        className="flex size-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-foreground/8 hover:text-foreground"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
              {users && list.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-muted">
                    {total === 0
                      ? "Belum ada pengguna."
                      : "Tidak ada pengguna yang cocok dengan filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <AuditList tick={tick} />

      <Portal>
        <AnimatePresence>
          {menu && (
            <ActionMenu
              key="menu"
              menu={menu}
              isSelf={menu.user.id === meId}
              onClose={() => setMenu(null)}
              onDialog={setDialog}
              onViewRuns={onViewRuns}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {dialog && (
            <Modal
              key="dialog"
              title={DIALOG_TITLE[dialog.type]}
              onClose={() => setDialog(null)}
              wide={dialog.type === "create" || dialog.type === "reset"}
            >
              <DialogBody
                dialog={dialog}
                onClose={() => setDialog(null)}
                onDone={(msg) => {
                  setToast(msg);
                  onChanged();
                }}
              />
            </Modal>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast}
              role="status"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-[#14142b] px-5 py-3 text-sm text-white shadow-2xl"
            >
              <CheckCircle2 className="size-4 text-emerald-400" />
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </Portal>
    </>
  );
}
