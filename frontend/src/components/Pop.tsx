"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/** Muncul membesar dengan efek pegas (untuk node bernomor). */
export default function Pop({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.span
      className={className}
      initial={{ scale: 0.3, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ type: "spring", stiffness: 260, damping: 16, delay }}
    >
      {children}
    </motion.span>
  );
}
