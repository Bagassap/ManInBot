"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { heroDelay } from "@/lib/splash-state";
import Script from "./Script";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Satu baris judul yang naik dari balik "topeng" (clip) saat muncul. */
function Line({ children, delay }: { children: ReactNode; delay: number }) {
  return (
    <span className="-my-[0.1em] block overflow-hidden py-[0.1em]">
      <motion.span
        className="block"
        initial={{ y: "115%", rotate: 2 }}
        animate={{ y: 0, rotate: 0 }}
        transition={{ duration: 0.95, delay: delay + heroDelay(), ease: EASE }}
      >
        {children}
      </motion.span>
    </span>
  );
}

export default function HeroTitle() {
  return (
    <h1 className="mt-10 text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
      <Line delay={0.15}>Asisten interaktif yang</Line>
      <Line delay={0.35}>
        <span className="text-accent-strong">
          <Script>benar-benar</Script> bekerja.
        </span>
      </Line>
    </h1>
  );
}
