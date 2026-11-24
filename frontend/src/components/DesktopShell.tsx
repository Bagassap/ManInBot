"use client";

import { FolderCog, Home, MessageSquare, PanelLeft, RefreshCw, Settings, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import { DesktopSlot, NEW_CHAT_EVENT } from "@/lib/desktop";

const COLLAPSE_KEY = "mib-sidebar-collapsed";
const noSubscribe = () => () => undefined;
const isDesktop = () => !!(window as unknown as { mibDesktop?: { isDesktop?: boolean } }).mibDesktop?.isDesktop;

interface ShellStatus {
  ready: boolean;
  email: string | null;
  name: string | null;
}

function NavRow({ href, label, icon: Icon, active, collapsed }: { href: string; label: string; icon: LucideIcon; active: boolean; collapsed: boolean }) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`flex h-10 items-center gap-3 rounded-xl text-sm transition-colors ${collapsed ? "w-10 justify-center" : "px-3"} ${
        active ? "bg-white/10 text-foreground" : "text-muted hover:bg-white/6 hover:text-foreground"
      }`}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

export default function DesktopShell({ children }: { children: React.ReactNode }) {
  const desktop = useSyncExternalStore(noSubscribe, isDesktop, () => false);
  const pathname = (usePathname() || "/app").replace(/\/$/, "") || "/app";
  const [status, setStatus] = useState<ShellStatus | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!desktop) return;
    document.documentElement.classList.add("desktop-app");
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
    }
    return () => document.documentElement.classList.remove("desktop-app");
  }, [desktop]);

  useEffect(() => {
    if (!desktop) return;
    let alive = true;
    const load = async () => {
      const [account, brain] = await Promise.all([
        api<{ accountReady: boolean; account: { email: string; name: string | null } | null }>("/settings").catch(() => null),
        api<{ ready: boolean }>("/brain").catch(() => null),
      ]);
      if (alive) setStatus({ ready: !!account?.accountReady && !!brain?.ready, email: account?.account?.email ?? null, name: account?.account?.name ?? null });
    };
    void load();
    window.addEventListener("mib-account", load);
    return () => {
      alive = false;
      window.removeEventListener("mib-account", load);
    };
  }, [desktop, pathname]);

  if (!desktop) return <>{children}</>;

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
    }
  };
  const iconBtn = "flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/8 hover:text-foreground";
  const display = status?.name || status?.email || "Akun MiB";

  return (
    <DesktopSlot.Provider value={slot}>
      <div className="cp-frame">
        {status?.ready && (
          <aside className={`cp-sidebar ${collapsed ? "cp-collapsed" : ""}`} aria-label="Navigasi aplikasi">
            <div className={`cp-sidebar-head ${collapsed ? "flex-col" : ""}`}>
              {!collapsed && (
                <span className="mr-auto flex items-center gap-2">
                  <Image src="/asset/logo-mark-v2.png" alt="" width={24} height={27} className="shrink-0" />
                  <span className="text-[17px] font-semibold tracking-tight">MiB</span>
                </span>
              )}
              <button type="button" onClick={toggle} className={`cp-nodrag ${iconBtn}`} title={collapsed ? "Buka sidebar" : "Tutup sidebar"} aria-label={collapsed ? "Buka sidebar" : "Tutup sidebar"} aria-expanded={!collapsed}>
                <PanelLeft className="size-4" />
              </button>
              <Link href="/app" onClick={() => window.dispatchEvent(new Event(NEW_CHAT_EVENT))} className={`cp-nodrag ${iconBtn}`} title="Beranda" aria-label="Beranda">
                <Home className="size-4" />
              </Link>
              <button type="button" onClick={() => window.location.reload()} className={`cp-nodrag ${iconBtn}`} title="Muat ulang (F5)" aria-label="Muat ulang aplikasi">
                <RefreshCw className="size-3.5" />
              </button>
            </div>

            <div ref={setSlot} className={`cp-history ${collapsed ? "hidden" : ""}`} />
            {collapsed && <div className="flex-1" />}

            <nav className={`flex flex-col gap-0.5 ${collapsed ? "items-center" : ""}`} aria-label="Menu">
              {pathname !== "/app" && <NavRow href="/app" label="Percakapan" icon={MessageSquare} active={false} collapsed={collapsed} />}
              <NavRow href="/app/workspace" label="Workspace" icon={FolderCog} active={pathname === "/app/workspace"} collapsed={collapsed} />
              <NavRow href="/app/settings" label="Pengaturan" icon={Settings} active={pathname === "/app/settings"} collapsed={collapsed} />
            </nav>
            <Link href="/app/settings" title={display} aria-label={`Akun ${display}`} className={`mt-2 flex items-center gap-2.5 rounded-xl bg-white/6 transition-colors hover:bg-white/10 ${collapsed ? "size-10 justify-center self-center" : "px-3 py-2"}`}>
              <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/25 text-xs font-semibold text-accent-strong">
                {display.charAt(0).toUpperCase()}
              </span>
              {!collapsed && (
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{display}</span>
                  {status.email && status.name && <span className="block truncate text-[11px] text-muted">{status.email}</span>}
                </span>
              )}
            </Link>
          </aside>
        )}
        <main className={`cp-panel ${status?.ready ? "" : "cp-panel-full"}`}>
          <div className="cp-drag" />
          <div className="cp-content">{children}</div>
        </main>
      </div>
    </DesktopSlot.Provider>
  );
}
