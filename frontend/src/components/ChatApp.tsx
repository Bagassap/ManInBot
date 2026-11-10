"use client";

import {
  Check,
  LogOut,
  Settings,
  Menu,
  Plus,
  SendHorizontal,
  Square,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Script from "@/components/Script";
import ApprovalCard, { type ApprovalRequest } from "@/components/ApprovalCard";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import { useWorkspace, wsPath } from "@/lib/workspace";
import {
  api,
  ApiError,
  streamMessage,
  type ChatMessage,
  type ConversationItem,
  type Step,
  type User,
} from "@/lib/api";

const SUGGESTIONS = [
  "Jelaskan konsep inflasi dengan contoh sehari-hari",
  "Buat rencana belajar Python selama 4 minggu",
  "Hitung (12500 × 3) + 4000 ÷ 8 dan tunjukkan langkahnya",
  "Tulis email permohonan maaf atas keterlambatan pengiriman",
];

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
  const [agentReady, setAgentReady] = useState(true);
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
    api<{ agentReady: boolean }>("/settings").then(
      (s) => setAgentReady(s.agentReady),
      () => undefined,
    );
  }, []);

  useEffect(() => {
    if (ws.unauthorized) router.replace("/masuk");
  }, [ws.unauthorized, router]);

  // Berpindah workspace: percakapan yang terbuka milik workspace lama, jadi layar dikosongkan.
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
      // Dihentikan/terputus sebelum selesai: pertahankan teks parsial di layar.
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

  // Salinan terbaru liveText untuk dibaca di blok finally.
  const liveTextRef = useRef("");
  useEffect(() => {
    liveTextRef.current = liveText;
  }, [liveText]);

  const empty = messages.length === 0 && !busy;

  return (
    <div className="flex h-dvh">
      {/* Sidebar */}
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
          <button
            onClick={logout}
            aria-label="Keluar"
            className="text-muted hover:text-foreground"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>
      {sidebar && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebar(false)}
        />
      )}

      {/* Chat */}
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3 md:hidden">
          <button onClick={() => setSidebar(true)} aria-label="Buka menu">
            <Menu className="size-5" />
          </button>
          <span className="font-display font-semibold">MiB</span>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto max-w-3xl space-y-4">
            {empty && (
              <div className="pt-[10vh] text-center">
                <Image
                  src="/asset/logo-mark-v2.png"
                  alt=""
                  width={70}
                  height={79}
                  className="mx-auto"
                />
                <h1 className="mt-6 text-2xl font-semibold">
                  Apa yang ingin Anda <Script>kerjakan</Script>?
                </h1>
                <p className="mt-2 text-sm text-muted">
                  Beri perintah, MiB langsung mengeksekusinya.
                </p>
                <div className="mx-auto mt-8 grid max-w-xl gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-xl border border-line bg-surface/50 px-4 py-3 text-left text-sm transition-colors hover:border-accent/60"
                    >
                      {s}
                    </button>
                  ))}
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

            {!agentReady && (
              <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                MiB belum punya kunci API Claude.{" "}
                <Link href="/app/settings" className="underline">
                  Masukkan di Pengaturan
                </Link>{" "}
                agar bisa bekerja.
              </p>
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

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="border-t border-line px-4 py-4"
        >
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-line bg-surface/70 p-2 focus-within:border-accent">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              maxLength={8000}
              placeholder="Ketik perintah untuk MiB…"
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted/60"
            />
            {busy ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                aria-label="Hentikan"
                className="flex size-10 items-center justify-center rounded-xl bg-surface text-foreground hover:bg-line"
              >
                <Square className="size-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                aria-label="Kirim"
                className="flex size-10 items-center justify-center rounded-xl bg-accent text-[#0d1417] transition-colors hover:bg-accent-strong disabled:opacity-40"
              >
                <SendHorizontal className="size-4" />
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
