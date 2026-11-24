"use client";

import {
  Check,
  ChevronDown,
  History,
  LogOut,
  MessageSquare,
  RefreshCw,
  Settings,
  Menu,
  Plus,
  SendHorizontal,
  Sparkles,
  Square,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ApprovalCard, { type ApprovalRequest } from "@/components/ApprovalCard";
import VoiceControls from "@/components/VoiceControls";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import { DesktopSlot, NEW_CHAT_EVENT } from "@/lib/desktop";
import { useWorkspace, wsPath } from "@/lib/workspace";
import {
  api,
  API_URL,
  ApiError,
  streamMessage,
  type ChatMessage,
  type ConversationItem,
  type Step,
  type User,
} from "@/lib/api";

const CHIPS: [string, string][] = [
  ["Buat surat", "Buka Word dan ketik surat penawaran untuk PT Maju, lalu simpan di folder Dokumen"],
  ["Rekap Excel", "Buka Excel dan buat tabel rekap penjualan per bulan lengkap dengan totalnya"],
  ["Buat slide", "Baca laporan.docx dan buat ringkasannya dalam 5 slide PowerPoint"],
  ["Notulen rapat", "Buka Word dan tulis notulen rapat mingguan dengan daftar tindak lanjut"],
  ["Rapikan folder", "Lihat isi folder Dokumen dan sarankan cara merapikannya"],
];
const APPS: [string, string, string][] = [
  ["Word", "W", "#2f6fbd"],
  ["Excel", "X", "#23865a"],
  ["PowerPoint", "P", "#c4593a"],
  ["Outlook", "O", "#2788b8"],
];
const TIER_NAME: Record<string, string> = { ringan: "Ringan", sedang: "Sedang", kuat: "Kuat" };

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}

function StepList({ steps }: { steps: Step[] }) {
  if (!steps.length) return null;
  return (
    <ul className="mb-3 space-y-1.5">
      {steps.map((s) => (
        <li
          key={s.id}
          className="flex items-start gap-2 rounded-lg border border-line bg-background/50 px-3 py-2 font-mono text-xs"
        >
          {s.output === "" && !s.isError ? (
            <Wrench className="mt-0.5 size-3.5 shrink-0 animate-pulse text-accent-strong" />
          ) : (
            <Check
              className={`mt-0.5 size-3.5 shrink-0 ${s.isError ? "text-red-300" : "text-accent-strong"}`}
            />
          )}
          <span className="min-w-0 break-words">
            <span className="text-accent-strong">{s.name}</span>
            <span className="text-muted">({JSON.stringify(s.input)})</span>
            {s.output !== "" && (
              <span className={s.isError ? "text-red-300" : ""}>
                {" "}
                → {s.output}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Bubble({
  role,
  content,
  steps,
}: {
  role: ChatMessage["role"];
  content: string;
  steps?: Step[] | null;
}) {
  const mine = role === "USER";
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`flex ${mine ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          mine
            ? "bg-accent/20 text-foreground"
            : "border border-line bg-surface/70"
        }`}
      >
        {!mine && steps && <StepList steps={steps} />}
        <p className="whitespace-pre-wrap break-words">{content}</p>
      </div>
    </motion.div>
  );
}

export default function ChatApp() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [convs, setConvs] = useState<ConversationItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [liveSteps, setLiveSteps] = useState<Step[]>([]);
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const [error, setError] = useState("");
  const [sidebar, setSidebar] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [agentReady, setAgentReady] = useState(true);
  const [needAccount, setNeedAccount] = useState(false);
  const [reply, setReply] = useState<{ id: string; text: string } | null>(null);
  const [brainTier, setBrainTier] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("");
  const slot = useContext(DesktopSlot);
  const ws = useWorkspace();
  const wsId = ws.current?.id ?? null;

  const refreshList = useCallback(async () => {
    if (!wsId) return;
    setConvs(await api<ConversationItem[]>(wsPath(wsId, "/conversations")));
  }, [wsId]);

  useEffect(() => {
    (async () => {
      try {
        setUser(await api<User>("/auth/me"));
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) router.replace("/masuk");
        else setError("Tidak dapat terhubung ke server.");
      }
    })();
  }, [router]);

  useEffect(() => {
    api<{ ready: boolean; tier: string | null }>("/brain").then(
      (s) => {
        setAgentReady(s.ready);
        setBrainTier(s.ready ? s.tier : null);
      },
      () => undefined,
    );
    api<{ account: { name: string | null } | null }>("/settings").then(
      (s) => setAccountName(s.account?.name ?? ""),
      () => undefined,
    );
  }, []);

  const newChatRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    newChatRef.current = newChat;
  });
  useEffect(() => {
    const go = () => newChatRef.current();
    window.addEventListener(NEW_CHAT_EVENT, go);
    return () => window.removeEventListener(NEW_CHAT_EVENT, go);
  }, []);

  useEffect(() => {
    if (ws.unauthorized) router.replace("/masuk");
  }, [ws.unauthorized, router]);

  useEffect(() => {
    if (!wsId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveId(null);
    setMessages([]);
    setConvs([]);
    refreshList().catch(() => setError("Tidak dapat memuat percakapan."));
  }, [wsId, refreshList]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, liveText, liveSteps]);

  async function openConversation(id: string) {
    if (busy) return;
    setSidebar(false);
    setActiveId(id);
    setError("");
    if (!wsId) return;
    const conv = await api<{ messages: ChatMessage[] }>(
      wsPath(wsId, `/conversations/${id}`),
    );
    setMessages(conv.messages);
  }

  function newChat() {
    if (busy) return;
    setActiveId(null);
    setMessages([]);
    setError("");
    setSidebar(false);
  }

  async function removeConversation(id: string) {
    if (busy || !confirm("Hapus percakapan ini?")) return;
    if (!wsId) return;
    await api(wsPath(wsId, `/conversations/${id}`), { method: "DELETE" });
    if (id === activeId) newChat();
    await refreshList();
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/masuk");
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy || !wsId) return;
    if (!agentReady) {
      setNeedAccount(true);
      return;
    }
    setError("");
    setInput("");
    setBusy(true);
    setLiveText("");
    setLiveSteps([]);

    const abort = new AbortController();
    abortRef.current = abort;
    let finished = false;

    try {
      let id = activeId;
      if (!id) {
        id = (
          await api<ConversationItem>(wsPath(wsId, "/conversations"), {
            method: "POST",
          })
        ).id;
        setActiveId(id);
      }
      setMessages((m) => [
        ...m,
        { id: `tmp-${Date.now()}`, role: "USER", content },
      ]);

      await streamMessage(
        wsId,
        id,
        content,
        (e) => {
          if (e.type === "text") setLiveText((t) => t + e.delta);
          else if (e.type === "tool_start")
            setLiveSteps((s) => [
              ...s,
              {
                id: e.id,
                name: e.name,
                input: e.input,
                output: "",
                isError: false,
              },
            ]);
          else if (e.type === "tool_result")
            setLiveSteps((s) =>
              s.map((x) =>
                x.id === e.id
                  ? { ...x, output: e.output, isError: e.isError }
                  : x,
              ),
            );
          else if (e.type === "approval_request")
            setApproval({
              id: e.id,
              tool: e.tool,
              summary: e.summary,
              detail: e.detail,
            });
          else if (e.type === "approval_result")
            setApproval((a) => (a?.id === e.id ? null : a));
          else if (e.type === "done") {
            finished = true;
            setMessages((m) => [...m, e.message]);
            setReply({ id: e.message.id, text: e.message.content });
            setLiveText("");
            setLiveSteps([]);
          } else if (e.type === "error") setError(e.message);
        },
        abort.signal,
      );
    } catch (e) {
      if (!abort.signal.aborted)
        setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      if (!finished && liveTextRef.current) {
        setMessages((m) => [
          ...m,
          {
            id: `partial-${Date.now()}`,
            role: "ASSISTANT",
            content: liveTextRef.current,
          },
        ]);
      }
      setLiveText("");
      setLiveSteps([]);
      setApproval(null);
      setBusy(false);
      abortRef.current = null;
      refreshList().catch(() => {});
    }
  }

  const liveTextRef = useRef("");
  useEffect(() => {
    liveTextRef.current = liveText;
  }, [liveText]);

  const empty = messages.length === 0 && !busy;
  const firstName = accountName.trim().split(/\s+/)[0] ?? "";

  function prefill(text: string) {
    setInput(text);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      el?.focus();
      el?.setSelectionRange(text.length, text.length);
    });
  }

  const historyPanel = (
    <>
        {ws.workspaces && (
          <WorkspaceSwitcher
            workspaces={ws.workspaces}
            current={ws.current}
            onSelect={ws.select}
            onCreated={(id) => void ws.reload(id)}
          />
        )}
        <button
          onClick={newChat}
          className="mx-3 mb-3 flex items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm transition-colors hover:bg-surface"
        >
          <Plus className="size-4" /> Percakapan baru
        </button>
        <nav
          className="flex-1 space-y-1 overflow-y-auto px-3"
          aria-label="Riwayat percakapan"
        >
          {convs.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center rounded-lg ${c.id === activeId ? "bg-surface" : "hover:bg-surface/60"}`}
            >
              <button
                onClick={() => openConversation(c.id)}
                className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm"
              >
                {c.title}
              </button>
              <button
                onClick={() => removeConversation(c.id)}
                aria-label={`Hapus ${c.title}`}
                className="mr-2 hidden text-muted hover:text-red-300 group-hover:block"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </nav>
      {slot && convs.length === 0 && (
        <p className="px-4 py-3 text-xs leading-relaxed text-muted">
          Riwayat percakapan akan muncul di sini.
        </p>
      )}
    </>
  );

  const composer = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send(input);
      }}
      className="mx-auto w-full max-w-3xl"
    >
      <div className="cp-composer relative p-3">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={empty ? 2 : 1}
          maxLength={8000}
          placeholder="Tanyakan atau perintahkan apa saja untuk pekerjaan kantor…"
          className="max-h-40 min-h-10 w-full resize-none bg-transparent px-2 py-1.5 text-[15px] outline-none placeholder:text-muted/70"
        />
        <div className="mt-1 flex items-center gap-1">
          {API_URL === "" && brainTier && (
            <Link
              href="/app/settings"
              title="Ganti model di Pengaturan"
              className="flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-[13px] transition-colors hover:bg-white/8"
            >
              <Image src="/asset/logo-mark-v2.png" alt="" width={14} height={16} className="shrink-0" />
              {TIER_NAME[brainTier] ?? brainTier}
              <ChevronDown className="size-3.5 text-muted" />
            </Link>
          )}
          <div className="ml-auto flex items-center gap-1">
            {API_URL === "" && (
              <VoiceControls
                disabled={busy}
                reply={reply}
                onText={(t) => {
                  setInput((v) => (v.trim() ? `${v.trim()} ${t}` : t).slice(0, 8000));
                  inputRef.current?.focus();
                }}
                onError={setError}
              />
            )}
            {busy ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                aria-label="Hentikan"
                className="flex size-10 items-center justify-center rounded-full bg-white/10 text-foreground hover:bg-white/20"
              >
                <Square className="size-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                aria-label="Kirim"
                className="flex size-10 items-center justify-center rounded-full bg-accent text-[#0d1417] transition-colors hover:bg-accent-strong disabled:opacity-40"
              >
                <SendHorizontal className="size-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );

  return (
    <div className="flex h-dvh">
      {!slot && (
      <aside
        className={`${
          sidebar ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-line bg-background/95 backdrop-blur-md transition-transform md:static md:translate-x-0`}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <span className="flex items-center gap-2.5">
            <Image
              src="/asset/logo-mark-v2.png"
              alt=""
              width={28}
              height={32}
              className="shrink-0"
            />
            <span className="font-display text-lg font-semibold">MiB</span>
          </span>
          <button
            className="md:hidden"
            onClick={() => setSidebar(false)}
            aria-label="Tutup menu"
          >
            <X className="size-5" />
          </button>
        </div>
        {historyPanel}
        <Link
          href="/app/settings"
          className="mx-3 mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          <Settings className="size-4" /> Pengaturan
        </Link>
        <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
          <span className="min-w-0 truncate text-muted">
            {user?.name || user?.email}
          </span>
          {API_URL === "" ? (
            <button
              onClick={() => window.location.reload()}
              aria-label="Muat ulang"
              title="Muat ulang (F5)"
              className="text-muted hover:text-foreground"
            >
              <RefreshCw className="size-4" />
            </button>
          ) : (
            <button
              onClick={logout}
              aria-label="Keluar"
              className="text-muted hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          )}
        </div>
      </aside>
      )}
      {slot && createPortal(historyPanel, slot)}
      {sidebar && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebar(false)}
        />
      )}

      <section className="flex min-w-0 flex-1 flex-col">
        {!slot && (
          <header className="flex items-center gap-3 border-b border-line px-4 py-3 md:hidden">
            <button onClick={() => setSidebar(true)} aria-label="Buka menu">
              <Menu className="size-5" />
            </button>
            <span className="font-display font-semibold">MiB</span>
          </header>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className={`mx-auto ${empty ? "max-w-4xl" : "max-w-3xl"} space-y-4`}>
            {empty && (
              <div className="pb-6 pt-[3vh] text-center">
                <h1 className="text-balance text-[34px] font-semibold leading-tight tracking-tight">
                  {greeting()}{firstName ? `, ${firstName}` : ""}
                  <br />
                  Apa yang bisa MiB bantu hari ini?
                </h1>
                <div className="mt-7 text-left">{composer}</div>
                <div className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-2">
                  {CHIPS.map(([label, prompt]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => prefill(prompt)}
                      className="cp-chip px-4 py-2 text-sm text-foreground/85"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="mx-auto mt-6 grid max-w-3xl gap-4 text-left md:grid-cols-2">
                  <section className="cp-card p-5">
                    <h2 className="flex items-center gap-2 text-sm font-medium text-foreground/85">
                      <History className="size-4" /> Lanjutkan percakapan
                    </h2>
                    <div className="mt-3 space-y-1">
                      {convs.slice(0, 3).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => openConversation(c.id)}
                          className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition-colors hover:bg-white/8"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent-strong">
                            <MessageSquare className="size-4" />
                          </span>
                          <span className="min-w-0 truncate">{c.title}</span>
                        </button>
                      ))}
                      {convs.length === 0 && (
                        <p className="px-2 py-6 text-center text-sm text-muted">
                          Percakapan terbaru akan muncul di sini.
                        </p>
                      )}
                    </div>
                  </section>
                  <section className="cp-card p-5">
                    <h2 className="flex items-center gap-2 text-sm font-medium text-foreground/85">
                      <Sparkles className="size-4" /> Kerjakan di aplikasi
                    </h2>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {APPS.map(([name, letter, color]) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => prefill(`Buka ${name} dan `)}
                          className="flex items-center gap-2.5 rounded-xl px-2 py-2.5 text-left text-sm transition-colors hover:bg-white/8"
                        >
                          <span
                            aria-hidden
                            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                            style={{ background: color }}
                          >
                            {letter}
                          </span>
                          {name}
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            )}

            {messages.map((m) => (
              <Bubble
                key={m.id}
                role={m.role}
                content={m.content}
                steps={m.steps}
              />
            ))}

            {busy && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl border border-line bg-surface/70 px-4 py-3 text-sm leading-relaxed">
                  <StepList steps={liveSteps} />
                  {liveText ? (
                    <p className="whitespace-pre-wrap break-words">
                      {liveText}
                    </p>
                  ) : (
                    liveSteps.length === 0 && (
                      <span className="animate-pulse text-muted">
                        MiB sedang bekerja…
                      </span>
                    )
                  )}
                </div>
              </div>
            )}

            {needAccount && !agentReady && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
                <span className="text-muted">Otak MiB belum dipasang.</span>
                <Link
                  href="/app/settings"
                  className="rounded-lg bg-accent px-4 py-2 font-medium text-[#0d1417] transition-colors hover:bg-accent-strong"
                >
                  Pasang
                </Link>
              </div>
            )}

            {approval && wsId && (
              <ApprovalCard
                request={approval}
                onAnswer={async (allow) => {
                  try {
                    await api(wsPath(wsId, `/approvals/${approval.id}`), {
                      method: "POST",
                      body: JSON.stringify({ allow }),
                    });
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "Gagal mengirim jawaban",
                    );
                  }
                }}
              />
            )}

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
              >
                {error}
              </p>
            )}
            <div ref={endRef} />
          </div>
        </div>

        {!empty && <div className="px-4 pb-4 pt-2">{composer}</div>}
      </section>
    </div>
  );
}
