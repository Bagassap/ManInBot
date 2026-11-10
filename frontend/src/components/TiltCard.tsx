"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import type { MouseEvent, ReactNode } from "react";

/** Kartu yang miring halus mengikuti kursor, dengan sorot cahaya teal di bawah kursor. */
export default function TiltCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const spring = { stiffness: 220, damping: 22 };
  const rotateX = useSpring(useTransform(my, [0, 1], [5, -5]), spring);
  const rotateY = useSpring(useTransform(mx, [0, 1], [-5, 5]), spring);
  const spot = useTransform(
    [mx, my],
    ([x, y]: number[]) =>
      `radial-gradient(380px circle at ${x * 100}% ${y * 100}%, rgba(63,208,196,0.10), transparent 62%)`,
  );

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  }
  function onLeave() {
    mx.set(0.5);
    my.set(0.5);
  }

  return (
    <motion.div
      onMouseMove={reduced ? undefined : onMove}
      onMouseLeave={reduced ? undefined : onLeave}
      style={
        reduced ? undefined : { rotateX, rotateY, transformPerspective: 1000 }
      }
      className={`relative ${className}`}
    >
      {children}
      {!reduced && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ background: spot }}
        />
      )}
    </motion.div>
  );
}
