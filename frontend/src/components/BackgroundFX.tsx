"use client";

import { useEffect, useRef } from "react";

type Node = { x: number; y: number; vx: number; vy: number; r: number };
type Pulse = { a: number; b: number; t: number; speed: number };

const LINK_DIST = 150;
const MOUSE_DIST = 190;
const TEAL = "63, 208, 196"; // --accent-strong
const BLUE = "92, 140, 200";

export default function BackgroundFX() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const mouse = { x: -9999, y: -9999 };
    let w = 0;
    let h = 0;
    let nodes: Node[] = [];
    let pulses: Pulse[] = [];
    let raf = 0;
    let running = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(95, Math.max(32, Math.round((w * h) / 17000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        r: 1 + Math.random() * 1.6,
      }));
      pulses = [];
    };

    const spawnPulse = () => {
      if (pulses.length > 7) return;
      const a = Math.floor(Math.random() * nodes.length);
      let best = -1;
      let bestD = LINK_DIST;
      for (let k = 0; k < nodes.length; k++) {
        if (k === a) continue;
        const d = Math.hypot(nodes[a].x - nodes[k].x, nodes[a].y - nodes[k].y);
        if (d < bestD && Math.random() < 0.4) {
          bestD = d;
          best = k;
        }
      }
      if (best >= 0)
        pulses.push({ a, b: best, t: 0, speed: 0.012 + Math.random() * 0.012 });
    };

    const frame = () => {
      ctx.clearRect(0, 0, w, h);

      for (const n of nodes) {
        if (!reduced) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < -20) n.x = w + 20;
          else if (n.x > w + 20) n.x = -20;
          if (n.y < -20) n.y = h + 20;
          else if (n.y > h + 20) n.y = -20;

          // tarikan lembut ke arah kursor
          const dx = mouse.x - n.x;
          const dy = mouse.y - n.y;
          const d = Math.hypot(dx, dy);
          if (d < MOUSE_DIST && d > 1) {
            n.x += (dx / d) * 0.35;
            n.y += (dy / d) * 0.35;
          }
        }
      }

      // garis antar node
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < LINK_DIST) {
            ctx.strokeStyle = `rgba(${BLUE}, ${(1 - d / LINK_DIST) * 0.28})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        // garis ke kursor
        const md = Math.hypot(a.x - mouse.x, a.y - mouse.y);
        if (md < MOUSE_DIST) {
          ctx.strokeStyle = `rgba(${TEAL}, ${(1 - md / MOUSE_DIST) * 0.55})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }

      // node
      for (const n of nodes) {
        const md = Math.hypot(n.x - mouse.x, n.y - mouse.y);
        const near = md < MOUSE_DIST;
        ctx.fillStyle = near ? `rgba(${TEAL}, 0.95)` : `rgba(${BLUE}, 0.6)`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, near ? n.r + 0.8 : n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // denyut data berjalan di sepanjang garis
      if (!reduced) {
        if (Math.random() < 0.05) spawnPulse();
        pulses = pulses.filter((p) => p.t < 1);
        for (const p of pulses) {
          p.t += p.speed;
          const a = nodes[p.a];
          const b = nodes[p.b];
          const x = a.x + (b.x - a.x) * p.t;
          const y = a.y + (b.y - a.y) * p.t;
          const g = ctx.createRadialGradient(x, y, 0, x, y, 12);
          g.addColorStop(0, `rgba(${TEAL}, 0.95)`);
          g.addColorStop(1, `rgba(${TEAL}, 0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, 12, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (running && !reduced) raf = requestAnimationFrame(frame);
    };

    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onLeave = () => {
      mouse.x = mouse.y = -9999;
    };
    const onVisibility = () => {
      running = !document.hidden;
      if (running && !reduced) raf = requestAnimationFrame(frame);
      else cancelAnimationFrame(raf);
    };

    resize();
    frame();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* aurora yang melayang pelan */}
      <div className="fx-aurora fx-a absolute -left-[10%] top-[8%] size-[55vmax] rounded-full bg-accent/[0.035] blur-[130px]" />
      <div className="fx-aurora fx-b absolute -right-[12%] top-[38%] size-[50vmax] rounded-full bg-shield/[0.08] blur-[140px]" />
      <div className="fx-aurora fx-c absolute bottom-[-18%] left-[28%] size-[44vmax] rounded-full bg-accent/[0.025] blur-[130px]" />

      {/* grid tipis yang bergeser */}
      <div className="fx-grid absolute inset-0" />

      {/* jaringan node */}
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* vinyet agar teks tetap terbaca */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,var(--background)_100%)]" />
    </div>
  );
}
