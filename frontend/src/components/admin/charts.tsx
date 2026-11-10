"use client";

import { motion } from "framer-motion";
import { useId } from "react";

/** Grafik batang: tinggi tiap batang tumbuh dari bawah; warna makin pekat ke arah terbaru. */
export function BarChart({
  values,
  labels,
}: {
  values: number[];
  labels: string[];
}) {
  const max = Math.max(1, ...values);
  return (
    <div>
      <div
        className="flex h-24 items-end gap-1.5"
        role="img"
        aria-label="Grafik batang jumlah perintah"
      >
        {values.map((v, i) => (
          <div key={i} className="group relative flex h-full flex-1 items-end">
            <motion.div
              className="w-full rounded-t-md bg-accent"
              style={{ opacity: 0.25 + (0.75 * (i + 1)) / values.length }}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(4, (v / max) * 100)}%` }}
              transition={{
                duration: 0.7,
                delay: i * 0.03,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
            <span className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#1c1b38] px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
              {labels[i]}: {v}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted">
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}

/** Grafik garis dengan area gradasi; garis tergambar saat muncul. */
export function LineChart({
  values,
  labels,
}: {
  values: number[];
  labels: string[];
}) {
  const gid = useId();
  const W = 240;
  const H = 96;
  const pad = 8;
  const max = Math.max(1, ...values);
  const min = Math.min(...values);
  const span = Math.max(1, max - min);
  const pts = values.map((v, i) => [
    pad +
      (values.length === 1
        ? (W - pad * 2) / 2
        : (i * (W - pad * 2)) / (values.length - 1)),
    H - pad - ((v - min) / span) * (H - pad * 2),
  ]);
  const line = pts
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${H} L${pts[0][0].toFixed(1)} ${H} Z`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-24 w-full overflow-visible"
        role="img"
        aria-label="Grafik garis waktu respons"
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          d={area}
          fill={`url(#${gid})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        />
        <motion.path
          d={line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
        />
        {pts.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="2.6"
            fill="#fff"
            stroke="var(--accent)"
            strokeWidth="1.6"
          >
            <title>{`${labels[i]}: ${values[i].toFixed(1)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-muted">
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}
