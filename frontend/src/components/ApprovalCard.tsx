"use client";

import { Check, ShieldAlert, X } from "lucide-react";
import { useState } from "react";

export interface ApprovalRequest {
  id: string;
  tool: string;
  summary: string;
  detail: string | null;
}

const TOOL_LABEL: Record<string, string> = {
  fs_write: "Menulis berkas",
  shell_run: "Menjalankan perintah",
  excel_save_local: "Menyimpan dokumen",
  doc_create: "Membuat dokumen",
  doc_edit: "Mengubah dokumen",
  app_open: "Membuka di aplikasi Anda",
  computer_start: "Mengendalikan komputer",
};

/** Kartu izin: agen berhenti sampai pengguna memilih. Tampilkan persis apa yang akan dilakukan. */
export default function ApprovalCard({
  request,
  onAnswer,
}: {
  request: ApprovalRequest;
  onAnswer: (allow: boolean) => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const answer = async (allow: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await onAnswer(allow);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="alertdialog"
      aria-label="MiB meminta izin"
      className="rounded-2xl border border-amber-400/40 bg-amber-400/8 p-4"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-amber-200">
        <ShieldAlert className="size-4 shrink-0" />
        MiB meminta izin · {TOOL_LABEL[request.tool] ?? request.tool}
      </div>
      <p className="mt-2 break-words text-sm">{request.summary}</p>
      {request.detail && (
        <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-background/70 p-3 font-mono text-xs">
          {request.detail}
        </pre>
      )}
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => void answer(true)}
          disabled={busy}
          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-medium text-[#0d1417] transition-colors hover:bg-accent-strong disabled:opacity-50"
        >
          <Check className="size-4" /> Izinkan
        </button>
        <button
          onClick={() => void answer(false)}
          disabled={busy}
          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-line text-sm transition-colors hover:bg-white/5 disabled:opacity-50"
        >
          <X className="size-4" /> Tolak
        </button>
      </div>
      <p className="mt-2 text-[11px] text-muted">
        Tanpa jawaban dalam 5 menit, permintaan ditolak otomatis.
      </p>
    </div>
  );
}
