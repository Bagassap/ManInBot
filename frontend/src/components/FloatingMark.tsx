"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { heroDelay } from "@/lib/splash-state";

/** Lambang perisai di hero: muncul dari blur, lalu melayang pelan dengan cahaya berdenyut. */
export default function FloatingMark() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6, filter: "blur(14px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{
        duration: 1.1,
        delay: heroDelay(),
        ease: [0.22, 1, 0.36, 1],
      }}
      className="relative mx-auto w-fit"
    >
      <span
        aria-hidden
        className="fx-glow absolute -inset-[35%] rounded-full bg-accent/15 blur-3xl"
      />
      <div className="fx-float relative">
        <Image
          src="/asset/logo-mark-v2.png"
          alt="Logo MiB"
          width={100}
          height={113}
          priority
          className="mx-auto"
        />
      </div>
    </motion.div>
  );
}
