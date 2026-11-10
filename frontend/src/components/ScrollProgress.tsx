"use client";

import { motion, useScroll, useSpring } from "framer-motion";

/** Garis kemajuan gulir di tepi atas layar. */
export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 24,
    mass: 0.4,
  });
  return (
    <motion.div
      aria-hidden
      className="fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-gradient-to-r from-accent via-accent-strong to-shield"
      style={{ scaleX }}
    />
  );
}
