"use client";

import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  ChevronDown,
  Clock,
  Download,
  LogOut,
  RefreshCw,
  Search,
  ShieldOff,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart, LineChart } from "./charts";
import RunsPanel from "./RunsPanel";
import UsersManager from "./UsersManager";
import { api, ApiError, type User } from "@/lib/api";
import {
  adminApi,
  bucketSeries,
  fmtCompact,
  fmtDuration,
  fmtInt,
  runsToCsv,
  type RunStatus,
} from "@/lib/admin-api";
import { useFetch } from "@/lib/use-fetch";

type Tab = "ringkasan" | "pengguna";

const TABS: { key: Tab; label: string }[] = [
  { key: "ringkasan", label: "Ringkasan" },
  { key: "pengguna", label: "Pengguna" },
];

const selectCls =
  "h-11 w-full appearance-none rounded-2xl border border-line bg-surface pl-4 pr-10 text-xs text-foreground outline-none transition-colors hover:border-accent/40 focus:border-accent";

/** Persentase perubahan. `good` menentukan arah mana yang berwarna hijau. */
function Delta({
  value,
  good,
  suffix,
}: {
  value: number | null;
  good: "up" | "down" | "none";
  suffix: string;
}) {
  if (value === null)
    return (
      <p className="mt-1 text-xs text-muted">Baru, belum ada pembanding</p>
    );
  const up = value >= 0;
  const tone =
    good === "none" || Math.abs(value) < 0.05
      ? "text-muted"
      : (up ? "up" : "down") === good
        ? "text-emerald-600"
        : "text-rose-600";
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <p className={`mt-1 flex items-center gap-1 text-xs ${tone}`}>
      <Icon className="size-3.5" />
      <span className="font-medium">
        {Math.abs(value).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
      </span>
      <span className="text-muted">{suffix}</span>
    </p>
  );
}

function Card({
  title,
  icon,
  tone,
  children,
  delay = 0,
}: {
  title: string;
  icon: React.ReactNode;
  tone: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col rounded-3xl border border-line bg-surface p-5 shadow-[0_8px_30px_-18px_rgba(40,30,120,0.25)]"
    >
      <div className="flex items-center justify-between">
        <h3
          className="text-xs font-medium text-muted"
          style={{ fontFamily: "var(--font-satoshi), sans-serif" }}
        >
          {title}
        </h3>
        <span
          className={`flex size-8 items-center justify-center rounded-xl ${tone}`}
        >
          {icon}
        </span>
      </div>
      {children}
    </motion.article>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-foreground/8 ${className}`} />
  );
}

export default function AdminApp() {
  const router = useRouter();
  const me = useFetch<User>("me", () => api<User>("/auth/me"));
  const isAdmin = me.data?.role === "ADMIN";

  const [tab, setTab] = useState<Tab>("ringkasan");
  const [days, setDays] = useState(30);
  const [status, setStatus] = useState<RunStatus | "ALL">("ALL");
  const [userId, setUserId] = useState("");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [tick, setTick] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // belum login -> ke halaman masuk
  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401)
      router.replace("/admin/masuk");
  }, [me.error, router]);

  // debounce kotak pencarian
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 300);
    return () => clearTimeout(t);
  }, [qInput]);

  // segarkan otomatis tiap 30 detik selama tab terlihat
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") setTick((n) => n + 1);
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  const filters = { days, status, userId, q };
  const overview = useFetch(isAdmin ? `ov:${days}:${tick}` : null, () =>
    adminApi.overview(days),
  );
  const runs = useFetch(
    isAdmin ? `runs:${days}:${status}:${userId}:${q}:${tick}` : null,
    () => adminApi.runs(filters),
  );
  const users = useFetch(isAdmin ? `users:${days}:${tick}` : null, () =>
    adminApi.users(days),
  );

  const items = runs.data?.items ?? [];
  const activeId =
    selectedId && items.some((i) => i.id === selectedId)
      ? selectedId
      : (items[0]?.id ?? null);
  const detail = useFetch(activeId ? `d:${activeId}` : null, () =>
    adminApi.runDetail(activeId!),
  );

  const activeFilters =
    (status !== "ALL" ? 1 : 0) +
    (userId ? 1 : 0) +
    (q ? 1 : 0) +
    (days !== 30 ? 1 : 0);
  const kp = overview.data?.kpis;
  const buckets = overview.data ? bucketSeries(overview.data.series) : [];
  const topModel = overview.data?.models[0];
  const updated = overview.updatedAt
    ? new Date(overview.updatedAt).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "…";

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/admin/masuk");
  }

  function exportCsv() {
    const url = URL.createObjectURL(
      new Blob([runsToCsv(items)], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `perintah-agen-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------- status akses ---------- */
  if (me.loading || (me.data === null && !me.error)) {
    return (
      <div className="admin flex min-h-dvh items-center justify-center">
        <p className="animate-pulse text-sm text-muted">Memeriksa akses…</p>
      </div>
    );
  }
  if (me.error && !(me.error instanceof ApiError && me.error.status === 401)) {
    return (
      <div className="admin flex min-h-dvh items-center justify-center px-5">
        <div className="max-w-sm rounded-3xl border border-line bg-surface p-8 text-center">
          <AlertCircle className="mx-auto size-9 text-rose-500" />
          <h1 className="mt-4 text-xl font-semibold">Tidak dapat terhubung</h1>
          <p className="mt-2 text-sm text-muted">
            Server backend tidak menjawab. Pastikan backend berjalan di port
            4000, lalu muat ulang.
          </p>
        </div>
      </div>
    );
  }
  if (me.data && !isAdmin) {
    return (
      <div className="admin flex min-h-dvh items-center justify-center px-5">
        <div className="max-w-md rounded-3xl border border-line bg-surface p-8 text-center">
          <ShieldOff className="mx-auto size-9 text-accent-strong" />
          <h1 className="mt-4 text-xl font-semibold">Khusus admin</h1>
          <p className="mt-2 text-sm text-muted">
            Akun {me.data.email} tidak memiliki akses ke dashboard ini.
          </p>
          <p className="mt-4 rounded-xl bg-foreground/5 p-3 text-left font-mono text-xs text-muted">
            Menjadikan akun ini admin (di folder backend):
            <br />
            npm run cli -- make-admin {me.data.email}
          </p>
          <Link
            href="/app"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white"
          >
            <ArrowLeft className="size-4" /> Kembali ke chat
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin min-h-dvh p-3 sm:p-6">
      <div className="mx-auto max-w-[1400px] rounded-[32px] border border-white/70 bg-white/55 p-3 shadow-[0_30px_80px_-40px_rgba(60,50,160,0.35)] backdrop-blur sm:p-6">
        {/* ===== bilah atas ===== */}
        <header className="flex flex-wrap items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5" aria-label="MiB">
            <Image
              src="/asset/logo-mark-v2.png"
              alt=""
              width={32}
              height={36}
              className="shrink-0"
              priority
            />
            <span className="leading-tight">
              <span className="block font-display text-lg font-semibold tracking-tight">
                MiB
              </span>
              <span className="block text-[10px] text-muted">
                Pusat kendali agen
              </span>
            </span>
          </Link>

          <span
            className="hidden items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2 text-[11px] text-muted md:flex"
            title="Data diperbarui otomatis setiap 30 detik"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            {updated}
          </span>

          <nav
            aria-label="Bagian dashboard"
            className="order-3 w-full overflow-x-auto sm:order-none sm:w-auto"
          >
            <div className="flex w-max gap-1 rounded-2xl bg-[#14142b] p-1.5 shadow-lg shadow-[#14142b]/20">
              {TABS.map((t) => {
                const on = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    aria-current={on ? "page" : undefined}
                    className={`relative rounded-xl px-4 py-2 text-xs font-medium transition-colors ${on ? "text-white" : "text-white/60 hover:text-white"}`}
                  >
                    {on && (
                      <motion.span
                        layoutId="admin-tab"
                        className="absolute inset-0 rounded-xl bg-accent"
                        transition={{
                          type: "spring",
                          stiffness: 420,
                          damping: 34,
                        }}
                      />
                    )}
                    <span className="relative">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setTick((n) => n + 1)}
              aria-label="Segarkan data"
              className="flex size-11 items-center justify-center rounded-2xl border border-line bg-surface text-muted transition-colors hover:text-foreground"
            >
              <RefreshCw
                className={`size-4 ${overview.loading || runs.loading ? "animate-spin" : ""}`}
              />
            </button>
            <span className="hidden items-center gap-2.5 rounded-2xl border border-line bg-surface py-1.5 pl-1.5 pr-3 sm:flex">
              <span className="flex size-8 items-center justify-center rounded-xl bg-accent/12 text-xs font-semibold text-accent-strong">
                {(me.data?.name || me.data?.email || "A")
                  .slice(0, 1)
                  .toUpperCase()}
              </span>
              <span className="max-w-[140px] truncate text-xs">
                {me.data?.name || me.data?.email}
              </span>
            </span>
            <button
              onClick={logout}
              aria-label="Keluar"
              className="flex size-11 items-center justify-center rounded-2xl border border-line bg-surface text-muted transition-colors hover:text-rose-600"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </header>

        {/* ===== judul ===== */}
        <div className="mt-6 flex flex-wrap items-start justify-between gap-4 sm:mt-8">
          <div className="flex items-start gap-4">
            <Link
              href="/app"
              aria-label="Kembali ke chat"
              className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface transition-colors hover:border-accent/40"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Pengawasan agen
              </h1>
              <p className="mt-1 text-sm text-muted">
                Pantau pemakaian, kecepatan, dan kesalahan layanan agen AI di
                satu tempat.
              </p>
            </div>
          </div>
          {tab === "ringkasan" && (
            <button
              onClick={exportCsv}
              disabled={items.length === 0}
              className="flex h-11 items-center gap-2 rounded-2xl bg-accent px-5 text-sm font-medium text-white shadow-lg shadow-accent/30 transition-colors hover:bg-accent-strong disabled:opacity-40"
            >
              <Download className="size-4" /> Ekspor CSV
            </button>
          )}
        </div>

        {tab === "ringkasan" ? (
          <>
            {/* ===== KPI ===== */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card
                title="Kesalahan"
                icon={<AlertCircle className="size-4" />}
                tone="bg-rose-500/10 text-rose-600"
              >
                {kp ? (
                  <>
                    <p className="mt-4 text-3xl font-semibold tabular-nums">
                      {fmtInt(kp.errors.value)}
                    </p>
                    <Delta
                      value={kp.errors.delta}
                      good="down"
                      suffix={`dari ${days} hari sebelumnya`}
                    />
                    <div className="mt-auto pt-6">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-muted">Tingkat kesalahan</span>
                        <span className="font-semibold">
                          {kp.errors.rate.toLocaleString("id-ID", {
                            maximumFractionDigits: 1,
                          })}
                          %
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-foreground/8">
                        <motion.div
                          className="h-full rounded-full bg-rose-500"
                          initial={{ width: 0 }}
                          animate={{
                            width: `${Math.min(100, kp.errors.rate)}%`,
                          }}
                          transition={{
                            duration: 0.9,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-muted">
                        {fmtInt(kp.errors.value)} dari {fmtInt(kp.runs.value)}{" "}
                        perintah
                      </p>
                    </div>
                  </>
                ) : (
                  <Skeleton className="mt-4 h-40" />
                )}
              </Card>

              <Card
                title="Perintah per hari"
                icon={<Zap className="size-4" />}
                tone="bg-accent/10 text-accent-strong"
                delay={0.06}
              >
                {kp ? (
                  <>
                    <p className="mt-4 text-3xl font-semibold tabular-nums">
                      {fmtInt(kp.runs.value)}
                    </p>
                    <Delta
                      value={kp.runs.delta}
                      good="up"
                      suffix={`dari ${days} hari sebelumnya`}
                    />
                    <div className="mt-auto pt-4">
                      <BarChart
                        values={buckets.map((b) => b.runs)}
                        labels={buckets.map((b) => b.label)}
                      />
                    </div>
                  </>
                ) : (
                  <Skeleton className="mt-4 h-40" />
                )}
              </Card>

              <Card
                title="Rata-rata waktu respons"
                icon={<Clock className="size-4" />}
                tone="bg-sky-500/10 text-sky-600"
                delay={0.12}
              >
                {kp ? (
                  <>
                    <p className="mt-4 text-3xl font-semibold tabular-nums">
                      {fmtDuration(kp.latency.avgMs)}
                    </p>
                    <Delta
                      value={kp.latency.delta}
                      good="down"
                      suffix={`dari ${days} hari sebelumnya`}
                    />
                    <div className="mt-auto pt-4">
                      <LineChart
                        values={buckets.map((b) => b.avgLatencyMs / 1000)}
                        labels={buckets.map((b) => b.label)}
                      />
                    </div>
                  </>
                ) : (
                  <Skeleton className="mt-4 h-40" />
                )}
              </Card>

              <Card
                title="Pemakaian token"
                icon={<Zap className="size-4" />}
                tone="bg-emerald-500/10 text-emerald-600"
                delay={0.18}
              >
                {kp ? (
                  <>
                    <p className="mt-4 text-3xl font-semibold tabular-nums">
                      {fmtCompact(kp.tokens.total)}
                    </p>
                    <Delta
                      value={kp.tokens.delta}
                      good="none"
                      suffix={`dari ${days} hari sebelumnya`}
                    />
                    <div className="mt-auto grid grid-cols-3 gap-2 pt-4 text-center">
                      {[
                        {
                          l: "Masuk",
                          v: fmtCompact(kp.tokens.input),
                          hi: false,
                        },
                        {
                          l: "Keluar",
                          v: fmtCompact(kp.tokens.output),
                          hi: true,
                        },
                        {
                          l: "Alat",
                          v: fmtInt(kp.tokens.toolCalls),
                          hi: false,
                        },
                      ].map((c) => (
                        <div
                          key={c.l}
                          className={`rounded-2xl px-2 py-3 ${c.hi ? "bg-accent text-white shadow-lg shadow-accent/30" : "bg-foreground/5"}`}
                        >
                          <p className="text-sm font-semibold tabular-nums">
                            {c.v}
                          </p>
                          <p
                            className={`mt-0.5 text-[10px] ${c.hi ? "text-white/80" : "text-muted"}`}
                          >
                            {c.l}
                          </p>
                        </div>
                      ))}
                    </div>
                    {topModel && (
                      <p
                        className="mt-3 truncate rounded-xl bg-[#14142b] px-3 py-2 text-center text-[11px] text-white"
                        title={topModel.model}
                      >
                        {topModel.model} ·{" "}
                        {Math.round(
                          (topModel.runs / Math.max(1, kp.runs.value)) * 100,
                        )}
                        % perintah
                      </p>
                    )}
                  </>
                ) : (
                  <Skeleton className="mt-4 h-40" />
                )}
              </Card>
            </div>

            {/* ===== filter ===== */}
            <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
              <span className="flex items-center gap-2 text-xs font-medium">
                Filter aktif
                <span className="flex size-6 items-center justify-center rounded-full bg-[#14142b] text-[11px] text-white">
                  {activeFilters}
                </span>
              </span>
              <div className="grid w-full flex-1 grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-4">
                <label className="relative">
                  <span className="sr-only">Periode</span>
                  <select
                    className={selectCls}
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                  >
                    <option value={7}>7 hari terakhir</option>
                    <option value={30}>30 hari terakhir</option>
                    <option value={90}>90 hari terakhir</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                </label>
                <label className="relative">
                  <span className="sr-only">Status</span>
                  <select
                    className={selectCls}
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as RunStatus | "ALL")
                    }
                  >
                    <option value="ALL">Semua status</option>
                    <option value="SUCCESS">Berhasil</option>
                    <option value="ERROR">Gagal</option>
                    <option value="ABORTED">Dibatalkan</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                </label>
                <label className="relative">
                  <span className="sr-only">Pengguna</span>
                  <select
                    className={selectCls}
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                  >
                    <option value="">Semua pengguna</option>
                    {(users.data ?? []).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                </label>
                <label className="relative">
                  <span className="sr-only">Cari perintah atau pengguna</span>
                  <input
                    type="search"
                    value={qInput}
                    onChange={(e) => setQInput(e.target.value)}
                    maxLength={100}
                    placeholder="Cari perintah / email"
                    className={`${selectCls} pr-10 placeholder:text-muted`}
                  />
                  <Search className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                </label>
              </div>
            </div>

            {/* ===== panel gelap: daftar + rincian ===== */}
            <div className="mt-5">
              <RunsPanel
                runs={runs.data}
                loading={runs.loading}
                status={status}
                onStatus={setStatus}
                activeId={activeId}
                onSelect={setSelectedId}
                detail={activeId ? detail.data : null}
                detailLoading={detail.loading}
              />
            </div>
          </>
        ) : (
          <div className="mt-6">
            <UsersManager
              users={users.data}
              loading={users.loading}
              meId={me.data?.id ?? ""}
              tick={tick}
              onViewRuns={(id) => {
                setUserId(id);
                setSelectedId(null);
                setTab("ringkasan");
              }}
              onChanged={() => setTick((n) => n + 1)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
