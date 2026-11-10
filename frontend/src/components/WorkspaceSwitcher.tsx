"use client";

import {
  Building2,
  Check,
  ChevronsUpDown,
  Plus,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  ROLE_LABEL,
  type WorkspaceItem,
  type WorkspaceRole,
} from "@/lib/workspace";

export default function WorkspaceSwitcher({
  workspaces,
  current,
  onSelect,
  onCreated,
  className = "mx-3 mb-3",
}: {
  workspaces: WorkspaceItem[];
  current: WorkspaceItem | null;
  onSelect: (id: string) => void;
  onCreated: (id: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2 || busy) return;
    setBusy(true);
    setError("");
    try {
      const ws = await api<WorkspaceItem>("/workspaces", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setName("");
      setCreating(false);
      setOpen(false);
      onCreated(ws.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat workspace");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-xl border border-line px-3 py-2.5 text-left transition-colors hover:bg-surface"
      >
        <Building2 className="size-4 shrink-0 text-accent-strong" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {current?.name ?? "Pilih workspace"}
          </span>
          {current && (
            <span className="block text-[11px] text-muted">
              {ROLE_LABEL[current.role as WorkspaceRole]}
            </span>
          )}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted" />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-40 mt-1.5 rounded-xl border border-line bg-background p-1.5 shadow-xl shadow-black/50">
          <ul role="listbox" className="max-h-56 overflow-y-auto">
            {workspaces.map((w) => (
              <li key={w.id}>
                <button
                  role="option"
                  aria-selected={w.id === current?.id}
                  onClick={() => {
                    onSelect(w.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-surface"
                >
                  <span className="min-w-0 flex-1 truncate">{w.name}</span>
                  <span className="text-[11px] text-muted">
                    {ROLE_LABEL[w.role]}
                  </span>
                  {w.id === current?.id && (
                    <Check className="size-4 text-accent-strong" />
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-1 border-t border-line pt-1">
            {current && (
              <Link
                href="/app/workspace"
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-surface"
              >
                <Settings2 className="size-4" /> Anggota &amp; audit
              </Link>
            )}
            {creating ? (
              <form onSubmit={create} className="p-1.5">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  placeholder="Nama perusahaan"
                  aria-label="Nama workspace baru"
                  className="h-9 w-full rounded-lg border border-line bg-transparent px-3 text-sm outline-none focus:border-accent"
                />
                {error && (
                  <p className="mt-1.5 text-xs text-red-300">{error}</p>
                )}
                <div className="mt-1.5 flex gap-1.5">
                  <button
                    type="submit"
                    disabled={busy || name.trim().length < 2}
                    className="h-8 flex-1 rounded-lg bg-accent text-xs font-medium text-[#0d1417] disabled:opacity-50"
                  >
                    {busy ? "Membuat…" : "Buat"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    className="h-8 rounded-lg border border-line px-3 text-xs"
                  >
                    Batal
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-surface"
              >
                <Plus className="size-4" /> Workspace baru
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
