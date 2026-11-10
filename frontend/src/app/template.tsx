"use client";

import { MotionConfig, motion } from "framer-motion";
import type { ReactNode } from "react";

/** Transisi halus saat berpindah halaman. Hanya opasitas, agar elemen `fixed` tidak ikut terpengaruh. */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex min-h-full flex-1 flex-col"
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
