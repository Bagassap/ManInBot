import { AlertTriangle, Info } from "lucide-react";
import type { Block } from "@/lib/docs";

/** Merender isi dokumentasi dari data terstruktur (tanpa HTML mentah). */
export default function DocBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-muted">
      {blocks.map((b, i) => {
        switch (b.t) {
          case "p":
            return <p key={i}>{b.text}</p>;
          case "h2":
            return (
              <h2 key={i} className="!mt-10 text-xl font-semibold text-foreground">
                {b.text}
              </h2>
            );
          case "ul":
            return (
              <ul key={i} className="list-disc space-y-1.5 pl-5">
                {b.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="list-decimal space-y-1.5 pl-5">
                {b.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ol>
            );
          case "code":
            return (
              <pre key={i} className="overflow-x-auto rounded-xl border border-line bg-surface p-4 font-mono text-sm text-accent-strong">
                {b.text}
              </pre>
            );
          case "note": {
            const warn = b.kind === "warn";
            const Icon = warn ? AlertTriangle : Info;
            return (
              <div
                key={i}
                className={`flex gap-3 rounded-xl border p-4 text-sm ${warn ? "border-amber-400/40 bg-amber-400/8 text-amber-100" : "border-accent/30 bg-accent/8 text-foreground"}`}
              >
                <Icon className="mt-0.5 size-4 shrink-0" />
                <p>{b.text}</p>
              </div>
            );
          }
          case "table":
            return (
              <div key={i} className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface text-foreground">
                    <tr>
                      {b.head.map((h) => (
                        <th key={h} className="px-4 py-2.5 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {b.rows.map((r, ri) => (
                      <tr key={ri}>
                        {r.map((c, ci) => (
                          <td key={ci} className="px-4 py-2.5 align-top">
                            {c}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}
