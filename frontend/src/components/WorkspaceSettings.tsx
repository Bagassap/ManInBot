"use client";

import { ArrowLeft, Loader2, LogOut, Trash2, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type User } from "@/lib/api";
import {
  ROLE_LABEL,
  useWorkspace,
  wsPath,
  type AuditItem,
  type InviteItem,
  type MemberItem,
  type WorkspaceRole,
} from "@/lib/workspace";
import LocalFolders from "./LocalFolders";
import WorkspaceSwitcher from "./WorkspaceSwitcher";

const ACTION_LABEL: Record<string, string> = {
  "workspace.created": "Membuat workspace",
  "workspace.renamed": "Mengganti nama workspace",
  "member.added": "Menambah anggota",
  "member.invited": "Mengundang anggota",
  "member.joined": "Bergabung lewat undangan",
  "member.role_changed": "Mengubah peran",
  "member.removed": "Mengeluarkan anggota",
  "member.left": "Keluar dari workspace",
  "invite.revoked": "Mencabut undangan",
  "agent.run": "Agen bekerja",
  "workbook.imported": "Mengunggah Excel",
  "workbook.exported": "Mengunduh Excel",
  "approval.requested": "Agen meminta izin",
  "approval.approved": "Izin diberikan",
  "approval.denied": "Izin ditolak",
  "approval.expired": "Izin kedaluwarsa",
  "folder.added": "Menambah folder izin",
  "folder.removed": "Mencabut folder izin",
  "local.fs_write": "Menulis berkas lokal",
  "local.shell_run": "Menjalankan perintah",
  "local.doc_create": "Membuat dokumen",
  "local.doc_edit": "Mengubah dokumen",
  "local.app_open": "Membuka di aplikasi",
  "computer.start": "Memulai kendali komputer",
  "computer.action": "Aksi di layar",
  "computer.stop": "Mengakhiri kendali komputer",
  "computer.interrupted": "Kendali dihentikan pengguna",
  "local.excel_open": "Membuka Excel lokal",
  "local.excel_save": "Menyimpan Excel lokal",
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const messageOf = (e: unknown) =>
  e instanceof Error ? e.message : "Terjadi kesalahan";

function Avatar({ m }: { m: Pick<MemberItem, "name" | "email"> }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-sm font-semibold text-accent-strong">
      {(m.name || m.email)[0]?.toUpperCase()}
    </span>
  );
}

export default function WorkspaceSettings() {
  const router = useRouter();
  const ws = useWorkspace();
  const current = ws.current;
  const [me, setMe] = useState<User | null>(null);
  const [tab, setTab] = useState<"members" | "folders" | "audit">("members");
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [auditNext, setAuditNext] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("MEMBER");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const wsId = current?.id ?? null;
  const myRole = current?.role ?? "MEMBER";
  const canManage = myRole === "OWNER" || myRole === "ADMIN";

  useEffect(() => {
    api<User>("/auth/me").then(setMe, (e) => {
      if (e instanceof ApiError && e.status === 401) router.replace("/masuk");
    });
  }, [router]);
  useEffect(() => {
    if (ws.unauthorized) router.replace("/masuk");
  }, [ws.unauthorized, router]);

  const loadMembers = useCallback(async () => {
    if (!wsId) return;
    const r = await api<{ members: MemberItem[]; invites: InviteItem[] }>(
      wsPath(wsId, "/members"),
    );
    setMembers(r.members);
    setInvites(r.invites);
  }, [wsId]);

  const loadAudit = useCallback(
    async (before?: string) => {
      if (!wsId || !canManage) return;
      const q = before ? `?before=${encodeURIComponent(before)}` : "";
      const r = await api<{ items: AuditItem[]; next: string | null }>(
        wsPath(wsId, `/audit${q}`),
      );
      setAudit((a) => (before ? [...a, ...r.items] : r.items));
      setAuditNext(r.next);
    },
    [wsId, canManage],
  );

  useEffect(() => {
    if (!wsId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
    setNotice("");
    setName(current?.name ?? "");
    loadMembers().catch((e) => setError(messageOf(e)));
    loadAudit().catch(() => {});
  }, [wsId, current?.name, loadMembers, loadAudit]);

  async function run(fn: () => Promise<void>, done?: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      if (done) setNotice(done);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsId || !email.trim()) return;
    void run(async () => {
      const r = await api<{ status: "added" | "invited" }>(
        wsPath(wsId, "/members"),
        { method: "POST", body: JSON.stringify({ email, role }) },
      );
      setNotice(
        r.status === "added"
          ? "Anggota ditambahkan."
          : "Undangan dibuat. Orang ini otomatis bergabung saat mendaftar atau masuk dengan email tersebut.",
      );
      setEmail("");
      await Promise.all([loadMembers(), loadAudit()]);
    });
  };

  const changeRole = (m: MemberItem, next: WorkspaceRole) =>
    wsId &&
    run(async () => {
      await api(wsPath(wsId, `/members/${m.id}`), {
        method: "PATCH",
        body: JSON.stringify({ role: next }),
      });
      await Promise.all([loadMembers(), ws.reload(wsId), loadAudit()]);
    }, "Peran diperbarui.");

  const removeMember = (m: MemberItem) => {
    const self = m.id === me?.id;
    if (
      !wsId ||
      !confirm(
        self
          ? `Keluar dari "${current?.name}"?`
          : `Keluarkan ${m.name || m.email} dari workspace?`,
      )
    )
      return;
    void run(async () => {
      await api(wsPath(wsId, `/members/${m.id}`), { method: "DELETE" });
      if (self) {
        await ws.reload();
        router.replace("/app");
        return;
      }
      await Promise.all([loadMembers(), loadAudit()]);
    });
  };

  const revoke = (i: InviteItem) =>
    wsId &&
    run(async () => {
      await api(wsPath(wsId, `/invites/${i.id}`), { method: "DELETE" });
      await Promise.all([loadMembers(), loadAudit()]);
    });

  const rename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsId || name.trim().length < 2 || name.trim() === current?.name)
      return;
    void run(async () => {
      await api(wsPath(wsId), {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      await Promise.all([ws.reload(wsId), loadAudit()]);
    }, "Nama workspace diperbarui.");
  };

  const destroy = () => {
    if (
      !wsId ||
      !confirm(
        `Hapus workspace "${current?.name}" beserta semua percakapan, lembar kerja, dan catatannya? Tindakan ini tidak bisa dibatalkan.`,
      )
    )
      return;
    void run(async () => {
      await api(wsPath(wsId), { method: "DELETE" });
      await ws.reload();
      router.replace("/app");
    });
  };

  const roleOptions = (target: MemberItem): WorkspaceRole[] =>
    myRole === "OWNER"
      ? ["OWNER", "ADMIN", "MEMBER"]
      : target.role === "OWNER"
        ? ["OWNER"]
        : ["ADMIN", "MEMBER"];

  if (!ws.workspaces || !current) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-5 text-center text-sm text-muted">
        {ws.error ? "Tidak dapat terhubung ke server." : "Memuat workspace…"}
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-3xl px-4 py-5 sm:px-6">
      <header className="flex items-center gap-3 pb-4">
        <Link
          href="/app"
          aria-label="Kembali"
          className="flex size-10 items-center justify-center rounded-xl border border-line transition-colors hover:bg-white/5"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="font-display text-lg font-semibold">Workspace</h1>
        <div className="ml-auto w-56">
          <WorkspaceSwitcher
            className=""
            workspaces={ws.workspaces}
            current={current}
            onSelect={ws.select}
            onCreated={(id) => void ws.reload(id)}
          />
        </div>
      </header>

      {(error || notice) && (
        <p
          role={error ? "alert" : "status"}
          className={`mb-4 rounded-xl border px-4 py-2.5 text-sm ${error ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-accent/30 bg-accent/10 text-accent-strong"}`}
        >
          {error || notice}
        </p>
      )}

      {canManage && (
        <form
          onSubmit={rename}
          className="mb-4 flex gap-2 rounded-2xl border border-line bg-surface p-3"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            aria-label="Nama workspace"
            className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-transparent px-3 text-sm outline-none focus:border-accent"
          />
          <button
            disabled={
              busy || name.trim().length < 2 || name.trim() === current.name
            }
            className="h-10 rounded-xl border border-line px-4 text-sm transition-colors hover:bg-white/5 disabled:opacity-40"
          >
            Simpan nama
          </button>
        </form>
      )}

      <div
        className="mb-3 flex gap-1 rounded-xl bg-white/6 p-1 text-sm"
        role="tablist"
      >
        {(
          [
            ["members", "Anggota"],
            ["folders", "Folder lokal"],
            ...(canManage ? [["audit", "Log audit"]] : []),
          ] as [typeof tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex-1 rounded-lg px-3 py-2 transition-colors ${tab === id ? "bg-accent font-medium text-[#0d1417]" : "text-muted hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "members" ? (
        <section className="space-y-3">
          {canManage && (
            <form
              onSubmit={invite}
              className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3 sm:flex-row"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@perusahaan.com"
                aria-label="Email anggota baru"
                className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-transparent px-3 text-sm outline-none focus:border-accent"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as WorkspaceRole)}
                aria-label="Peran"
                className="h-10 rounded-xl border border-line bg-background px-3 text-sm"
              >
                {(myRole === "OWNER"
                  ? (["MEMBER", "ADMIN", "OWNER"] as const)
                  : (["MEMBER", "ADMIN"] as const)
                ).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
              <button
                disabled={busy}
                className="flex h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-[#0d1417] hover:bg-accent-strong disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserPlus className="size-4" />
                )}
                Tambah
              </button>
            </form>
          )}

          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {members.map((m) => {
              const self = m.id === me?.id;
              const canRemove =
                self ||
                (canManage && (myRole === "OWNER" || m.role !== "OWNER"));
              return (
                <li key={m.id} className="flex items-center gap-3 p-3">
                  <Avatar m={m} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {m.name || m.email}
                      {self && (
                        <span className="ml-2 text-[11px] text-muted">
                          (Anda)
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {m.email}
                    </span>
                  </span>
                  {canManage ? (
                    <select
                      value={m.role}
                      disabled={
                        busy || (myRole !== "OWNER" && m.role === "OWNER")
                      }
                      onChange={(e) =>
                        void changeRole(m, e.target.value as WorkspaceRole)
                      }
                      aria-label={`Peran ${m.email}`}
                      className="h-9 rounded-lg border border-line bg-background px-2 text-xs disabled:opacity-60"
                    >
                      {roleOptions(m).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="rounded-md bg-white/6 px-2 py-1 text-xs text-muted">
                      {ROLE_LABEL[m.role]}
                    </span>
                  )}
                  {canRemove && (
                    <button
                      onClick={() => removeMember(m)}
                      disabled={busy}
                      aria-label={
                        self ? "Keluar dari workspace" : `Keluarkan ${m.email}`
                      }
                      title={self ? "Keluar" : "Keluarkan"}
                      className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/5 hover:text-red-300"
                    >
                      {self ? (
                        <LogOut className="size-4" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {invites.length > 0 && (
            <div>
              <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted">
                Undangan menunggu
              </h2>
              <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
                {invites.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center gap-3 p-3 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">{i.email}</span>
                    <span className="text-xs text-muted">
                      {ROLE_LABEL[i.role]}
                    </span>
                    {canManage && (
                      <button
                        onClick={() => void revoke(i)}
                        disabled={busy}
                        aria-label={`Cabut undangan ${i.email}`}
                        className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-white/5 hover:text-red-300"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {myRole === "OWNER" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-400/25 p-4">
              <p className="text-sm text-muted">
                Menghapus workspace menghapus semua percakapan, lembar kerja,
                dan catatannya.
              </p>
              <button
                onClick={destroy}
                disabled={busy}
                className="h-10 rounded-xl border border-red-400/40 px-4 text-sm text-red-200 transition-colors hover:bg-red-400/10 disabled:opacity-50"
              >
                Hapus workspace
              </button>
            </div>
          )}
        </section>
      ) : tab === "folders" ? (
        <LocalFolders workspaceId={current.id} canManage={canManage} />
      ) : (
        <section>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {audit.length === 0 && (
              <li className="p-4 text-sm text-muted">Belum ada catatan.</li>
            )}
            {audit.map((a) => (
              <li key={a.id} className="p-3 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">
                    {ACTION_LABEL[a.action] ?? a.action}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {fmtTime(a.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 break-words text-xs text-muted">
                  {a.actorEmail}
                  {a.target && a.action !== "agent.run" ? ` → ${a.target}` : ""}
                  {a.detail ? ` · ${a.detail}` : ""}
                </p>
              </li>
            ))}
          </ul>
          {auditNext && (
            <button
              onClick={() => void loadAudit(auditNext)}
              className="mt-3 h-10 w-full rounded-xl border border-line text-sm transition-colors hover:bg-white/5"
            >
              Muat lebih banyak
            </button>
          )}
        </section>
      )}
    </div>
  );
}
