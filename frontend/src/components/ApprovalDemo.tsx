"use client";

import ApprovalCard from "./ApprovalCard";

export default function ApprovalDemo() {
  return (
    <div className="pointer-events-none select-none" aria-label="Contoh tampilan kartu izin">
      <ApprovalCard
        request={{
          id: "contoh",
          tool: "doc_create",
          summary: "Membuat dokumen C:\\Users\\Anda\\Dokumen\\proposal.docx (9.214 byte)",
          detail: "# Proposal Kerja Sama\nRingkasan eksekutif ...\n• 3 butir\n[tabel 4 baris]",
        }}
        onAnswer={() => {}}
      />
    </div>
  );
}
