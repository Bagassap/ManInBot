import type { ReactNode } from "react";

export default function Script({ children }: { children: ReactNode }) {
  return (
    <em className="pr-[0.04em] text-[1.14em] font-normal italic leading-none tracking-normal text-accent-strong [font-family:var(--font-instrument),serif]">
      {children}
    </em>
  );
}
