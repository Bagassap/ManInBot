"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { splashState } from "@/lib/splash-state";

const DURATION_MS = 4600;
const EASE = [0.22, 1, 0.36, 1] as const;

// Posisi tetap (bukan acak) agar render server & client identik.
const PARTICLES = [
  { x: 8, y: 78, s: 3, d: 0.2 },
  { x: 16, y: 30, s: 2, d: 1.1 },
  { x: 24, y: 62, s: 4, d: 0.6 },
  { x: 33, y: 18, s: 2, d: 1.6 },
  { x: 41, y: 84, s: 3, d: 0.9 },
  { x: 58, y: 72, s: 2, d: 0.3 },
  { x: 66, y: 22, s: 4, d: 1.3 },
  { x: 74, y: 58, s: 3, d: 0.7 },
  { x: 83, y: 80, s: 2, d: 1.8 },
  { x: 90, y: 34, s: 3, d: 0.4 },
  { x: 12, y: 50, s: 2, d: 1.5 },
  { x: 94, y: 62, s: 4, d: 1.0 },
];

const STATUS = ["Menyiapkan agen", "Mengamankan sesi", "Siap bekerja"];

export default function Splash() {
  // Tampil sejak render pertama (SSR) agar landing tidak sempat berkedip; saat pindah
  // halaman di dalam situs (splashState.shown sudah true) langsung tidak ditampilkan.
  const [visible, setVisible] = useState(!splashState.shown);
  const [status, setStatus] = useState(0);
  const reduced = useReducedMotion();

  const close = useCallback(() => {
    splashState.shown = true;
    setVisible(false);
  }, []);

  useEffect(() => {
    if (splashState.shown) return;
    document.body.style.overflow = "hidden";
    const timers = [
      setTimeout(() => setStatus(1), 1500),
      setTimeout(() => setStatus(2), 3000),
      setTimeout(close, reduced ? 1800 : DURATION_MS),
    ];
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("keydown", onKey);
    };
  }, [close, reduced]);

  useEffect(() => {
    if (!visible) document.body.style.overflow = "";
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          role="status"
          aria-label="Memuat MiB"
          onClick={close}
          className="fixed inset-0 z-[100] flex cursor-pointer items-center justify-center overflow-hidden bg-background"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          {/* grid sirkuit tipis, memudar ke tepi */}
          <motion.div
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage:
                "radial-gradient(circle at center, #000 0%, transparent 62%)",
              WebkitMaskImage:
                "radial-gradient(circle at center, #000 0%, transparent 62%)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.55 }}
            transition={{ duration: 1.4 }}
          />

          {/* cahaya latar */}
          <motion.div
            aria-hidden
            className="absolute size-[46vmin] rounded-full bg-accent/[0.10] blur-[100px]"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.8, ease: "easeOut" }}
          />

          {/* partikel naik */}
          {!reduced &&
            PARTICLES.map((p, i) => (
              <motion.span
                key={i}
                aria-hidden
                className="absolute rounded-full bg-accent-strong"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  width: p.s,
                  height: p.s,
                }}
                initial={{ opacity: 0, y: 0 }}
                animate={{ opacity: [0, 0.8, 0], y: -60 }}
                transition={{
                  duration: 3,
                  delay: p.d,
                  repeat: 1,
                  ease: "easeOut",
                }}
              />
            ))}

          {/* logo */}
          <div className="relative aspect-[398/570] h-[min(40vh,360px,78vw)]">
            {/* cincin orbit berputar, berpusat di perisai; ukuran relatif terhadap logo agar responsif */}
            {!reduced &&
              [
                { pct: 105, dur: 14, dir: 1, dash: "2 10", delay: 0.4 },
                { pct: 135, dur: 22, dir: -1, dash: "40 14", delay: 0.7 },
              ].map((r) => (
                <motion.svg
                  key={r.pct}
                  aria-hidden
                  viewBox="0 0 100 100"
                  className="absolute"
                  style={{
                    left: "48%",
                    top: "31%",
                    width: `${r.pct}%`,
                    aspectRatio: "1",
                    translate: "-50% -50%",
                  }}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1, rotate: 360 * r.dir }}
                  transition={{
                    opacity: { duration: 1, delay: r.delay },
                    scale: { duration: 1.2, delay: r.delay, ease: EASE },
                    rotate: {
                      duration: r.dur,
                      ease: "linear",
                      repeat: Infinity,
                    },
                  }}
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="49"
                    fill="none"
                    stroke="var(--accent)"
                    strokeOpacity="0.55"
                    strokeWidth="0.4"
                    strokeDasharray={r.dash}
                  />
                  <circle cx="50" cy="1" r="1.4" fill="var(--accent-strong)" />
                </motion.svg>
              ))}

            {/* garis perisai tergambar */}
            <motion.svg
              aria-hidden
              viewBox="0 0 100 110"
              className="absolute"
              style={{
                left: "15.6%",
                top: "3.9%",
                width: "69.4%",
                height: "56%",
              }}
              initial={{ opacity: 1 }}
              animate={{ opacity: [1, 1, 0] }}
              transition={{ duration: 2, times: [0, 0.6, 1] }}
            >
              <motion.path
                d="M50 1 L98 17 L98 58 Q98 90 50 109 Q2 90 2 58 L2 17 Z"
                fill="none"
                stroke="var(--accent-strong)"
                strokeWidth="1.2"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.1, delay: 0.2, ease: "easeInOut" }}
              />
            </motion.svg>

            {/* perisai muncul */}
            <motion.img
              src="/asset/logo.png"
              alt="MiB — Man in Bot"
              draggable={false}
              className="absolute inset-0 size-full select-none object-contain"
              style={{ clipPath: "inset(0 0 38% 0)" }}
              initial={{ opacity: 0, scale: 0.9, filter: "blur(12px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 1, delay: 0.9, ease: EASE }}
            />

            {/* tulisan MiB / Man in Bot tersapu dari kiri */}
            <motion.img
              src="/asset/logo.png"
              alt=""
              aria-hidden
              draggable={false}
              className="absolute inset-0 size-full select-none object-contain"
              initial={{ clipPath: "inset(60% 100% 0 0)", opacity: 0, y: 12 }}
              animate={{ clipPath: "inset(60% 0% 0 0)", opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 1.7, ease: EASE }}
            />

            {/* denyut inti teal */}
            {[0, 0.6].map((delay) => (
              <motion.span
                key={delay}
                aria-hidden
                className="absolute rounded-full border border-accent-strong/80"
                style={{
                  left: "48%",
                  top: "28%",
                  width: "12.5%",
                  aspectRatio: "1",
                  translate: "-50% -50%",
                }}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: [0.6, 4.5], opacity: [0.8, 0] }}
                transition={{
                  duration: 1.6,
                  delay: 1.7 + delay,
                  ease: "easeOut",
                  repeat: 1,
                }}
              />
            ))}

            {/* garis pindai melintasi logo */}
            {!reduced && (
              <motion.div
                aria-hidden
                className="absolute inset-x-[-12%] h-px bg-gradient-to-r from-transparent via-accent-strong to-transparent shadow-[0_0_16px_2px_var(--accent)]"
                initial={{ top: "0%", opacity: 0 }}
                animate={{ top: "100%", opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.3, delay: 2.5, ease: "easeInOut" }}
              />
            )}
          </div>

          {/* status + progres */}
          <div
            aria-hidden
            className="absolute bottom-[9vh] flex flex-col items-center gap-3"
          >
            <div className="h-px w-44 overflow-hidden bg-line">
              <motion.div
                className="h-full bg-accent-strong"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{
                  duration: DURATION_MS / 1000 - 0.4,
                  ease: "easeInOut",
                }}
              />
            </div>
            <div className="h-4 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.p
                  key={status}
                  className="text-[11px] uppercase tracking-[0.28em] text-muted"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                >
                  {STATUS[status]}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
          <span className="absolute bottom-[4vh] text-[10px] tracking-[0.2em] text-muted/50">
            klik untuk lewati
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
