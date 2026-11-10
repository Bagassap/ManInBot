"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";

export interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
}

export interface MemberItem {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface InviteItem {
  id: string;
  email: string;
  role: WorkspaceRole;
  createdAt: string;
}

export interface AuditItem {
  id: string;
  actorEmail: string;
  action: string;
  target: string | null;
  detail: string | null;
  createdAt: string;
}

export const ROLE_LABEL: Record<WorkspaceRole, string> = {
  OWNER: "Pemilik",
  ADMIN: "Admin",
  MEMBER: "Anggota",
};

const KEY = "mib_workspace";

const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const write = (id: string) => {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* penyimpanan diblokir: pilihan hanya berlaku di sesi ini */
  }
};

/** Path API di dalam workspace, mis. wsPath(id, "/conversations"). */
export const wsPath = (workspaceId: string, path = "") =>
  `/workspaces/${workspaceId}${path}`;

/**
 * Daftar workspace pengguna dan yang sedang aktif. Pilihan diingat di browser; bila workspace
 * tersimpan sudah tidak bisa diakses (dikeluarkan/dihapus), otomatis pindah ke yang pertama.
 */
export function useWorkspace() {
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[] | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async (prefer?: string) => {
    try {
      const list = await api<WorkspaceItem[]>("/workspaces");
      const want = prefer ?? read();
      const pick = list.find((w) => w.id === want) ?? list[0] ?? null;
      setWorkspaces(list);
      setCurrentId(pick?.id ?? null);
      if (pick) write(pick.id);
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const select = useCallback((id: string) => {
    write(id);
    setCurrentId(id);
  }, []);

  const current = workspaces?.find((w) => w.id === currentId) ?? null;
  const unauthorized = error instanceof ApiError && error.status === 401;
  return { workspaces, current, select, reload, error, unauthorized };
}
