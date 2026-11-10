"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { heroDelay } from "@/lib/splash-state";

const VARIANTS = {
  up: { opacity: 0, y: 24 },
  left: { opacity: 0, x: -32 },
  right: { opacity: 0, x: 32 },
  scale: { opacity: 0, scale: 0.92 },
  blur: { opacity: 0, y: 16, filter: "blur(10px)" },
} as const;

const SHOWN = { opacity: 1, y: 0, x: 0, scale: 1, filter: "blur(0px)" };

export default function Reveal({
  children,
  delay = 0,
  className,
  variant = "up",
  afterSplash = false,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  variant?: keyof typeof VARIANTS;
  /** Untuk hero: tunda sampai animasi pembuka selesai (hanya pada kunjungan pertama). */
  afterSplash?: boolean;
}) {
  return (
    <motion.div
      className={className}
      initial={VARIANTS[variant]}
      whileInView={SHOWN}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        duration: 0.7,
        delay: delay + (afterSplash ? heroDelay() : 0),
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
