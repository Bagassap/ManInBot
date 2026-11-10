"use client";

import { FolderOpen, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { wsPath } from "@/lib/workspace";

interface FolderItem {
  id: string;
  path: string;
  mode: "READ" | "READWRITE";
}

/** Dipasang oleh aplikasi desktop (Electron) lewat preload; di browser biasa tidak ada. */
interface DesktopBridge {
  pickFolder?: () => Promise<string | null>;
}
const desktop = () =>
  typeof window === "undefined"
    ? undefined
    : (window as unknown as { mibDesktop?: DesktopBridge }).mibDesktop;

const messageOf = (e: unknown) =>
  e instanceof Error ? e.message : "Terjadi kesalahan";

export default function LocalFolders({
  workspaceId,
  canManage,
}: {
  workspaceId: string;
  canManage: boolean;
}) {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [path, setPath] = useState("");
  const [mode, setMode] = useState<FolderItem["mode"]>("READ");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setFolders(await api<FolderItem[]>(wsPath(workspaceId, "/folders")));
  }, [workspaceId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((e) => setError(messageOf(e)));
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!path.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await api(wsPath(workspaceId, "/folders"), {
        method: "POST",
        body: JSON.stringify({ path: path.trim(), mode }),
      });
      setPath("");
      await load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(f: FolderItem) {
    if (!confirm(`Cabut akses MiB ke ${f.path}?`)) return;
    setError("");
    try {
      await api(wsPath(workspaceId, `/folders/${f.id}`), { method: "DELETE" });
      await load();
    } catch (err) {
      setError(messageOf(err));
    }
  }

  const pick = desktop()?.pickFolder;

  return (
    <section className="space-y-3">
      <p className="rounded-2xl border border-line bg-surface p-4 text-sm leading-relaxed text-muted">
        MiB hanya bisa membaca atau mengubah berkas di folder yang Anda izinkan
        di sini. <b className="text-foreground">Membaca</b> langsung jalan;{" "}
        <b className="text-foreground">
          menulis berkas, menjalankan perintah, dan menyimpan dokumen
        </b>{" "}
        selalu meminta izin Anda dulu dan tercatat di log audit. Pilih folder
        sekecil mungkin.
      </p>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm text-red-200"
        >
          {error}
        </p>
      )}

      {canManage && (
        <form
          onSubmit={add}
          className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3 sm:flex-row"
        >
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="C:\Dokumen\Kantor"
            aria-label="Jalur folder"
            className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-transparent px-3 font-mono text-sm outline-none focus:border-accent"
          />
          {pick && (
            <button
              type="button"
              onClick={async () => {
                const p = await pick();
                if (p) setPath(p);
              }}
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-line px-3 text-sm hover:bg-white/5"
            >
              <FolderOpen className="size-4" /> Pilih…
            </button>
          )}
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as FolderItem["mode"])}
            aria-label="Mode akses"
            className="h-10 rounded-xl border border-line bg-background px-3 text-sm"
          >
            <option value="READ">Hanya baca</option>
            <option value="READWRITE">Baca &amp; tulis</option>
          </select>
          <button
            disabled={busy || !path.trim()}
            className="flex h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-[#0d1417] hover:bg-accent-strong disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Izinkan
          </button>
        </form>
      )}

      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {folders.length === 0 && (
          <li className="p-4 text-sm text-muted">
            Belum ada folder. Tanpa folder izin, MiB tidak bisa menyentuh berkas
            di komputer ini.
          </li>
        )}
        {folders.map((f) => (
          <li key={f.id} className="flex items-center gap-3 p-3">
            <FolderOpen className="size-4 shrink-0 text-accent-strong" />
            <span className="min-w-0 flex-1 break-all font-mono text-xs">
              {f.path}
            </span>
            <span
              className={`shrink-0 rounded-md px-2 py-1 text-xs ${f.mode === "READWRITE" ? "bg-amber-400/15 text-amber-200" : "bg-white/6 text-muted"}`}
            >
              {f.mode === "READWRITE" ? "Baca & tulis" : "Hanya baca"}
            </span>
            {canManage && (
              <button
                onClick={() => void remove(f)}
                aria-label={`Cabut ${f.path}`}
                className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-white/5 hover:text-red-300"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
