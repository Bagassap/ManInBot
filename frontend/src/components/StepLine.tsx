"use client";

import { motion } from "framer-motion";

/** Garis penghubung antar langkah: tergambar dari kiri ke kanan saat terlihat. */
export default function StepLine() {
  return (
    <motion.div
      aria-hidden
      className="fx-flow pointer-events-none absolute left-[16.6%] right-[16.6%] top-[27px] hidden h-px origin-left md:block"
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, margin: "-120px" }}
      transition={{ duration: 1.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
    />
  );
}
