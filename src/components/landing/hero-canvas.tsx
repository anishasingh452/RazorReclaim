"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  hue: "engine" | "ai";
}

const COLORS = {
  engine: "16, 185, 129",
  ai: "96, 145, 250",
} as const;

/**
 * The ambient particle field behind the hero — a drifting constellation
 * that links neighbouring nodes, echoing the product itself: independent
 * signals that only mean something once you connect them.
 *
 * Kept honest about cost: it stops rendering entirely when scrolled out of
 * view or when the tab is hidden, scales its population to the viewport,
 * and draws a single static frame for anyone who prefers reduced motion.
 */
export function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let frame: number | null = null;
    let visible = true;
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

    const seed = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.round(Math.min(Math.max(width / 13, 40), 110));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.14,
        vy: -0.08 - Math.random() * 0.22,
        r: 0.7 + Math.random() * 1.7,
        a: 0.18 + Math.random() * 0.5,
        hue: Math.random() > 0.62 ? "ai" : "engine",
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Ease the parallax offset toward the pointer so movement feels
      // weighted rather than glued to the cursor.
      pointer.x += (pointer.tx - pointer.x) * 0.045;
      pointer.y += (pointer.ty - pointer.y) * 0.045;
      const offsetX = (pointer.x - 0.5) * 26;
      const offsetY = (pointer.y - 0.5) * 18;

      // Links first, so nodes sit on top of their own connections.
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist2 = dx * dx + dy * dy;
          if (dist2 > 18000) continue;
          const strength = (1 - dist2 / 18000) * 0.22;
          ctx.strokeStyle = `rgba(120, 200, 180, ${strength})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(a.x + offsetX * 0.5, a.y + offsetY * 0.5);
          ctx.lineTo(b.x + offsetX * 0.5, b.y + offsetY * 0.5);
          ctx.stroke();
        }
      }

      for (const p of particles) {
        ctx.fillStyle = `rgba(${COLORS[p.hue]}, ${p.a})`;
        ctx.beginPath();
        ctx.arc(p.x + offsetX, p.y + offsetY, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    /**
     * One long-lived loop that simply skips its work while the hero is
     * scrolled out of view, rather than a start/stop state machine. Two
     * independent gates (an observer flag and a visibility flag) can latch
     * each other off — a stale "not intersecting" leaves nothing able to
     * restart the loop — and a paused hero is worse than a few no-op
     * callbacks. Browsers already suspend rAF entirely for hidden tabs, so
     * the idle cost here is nil.
     */
    const step = () => {
      if (visible) {
        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;
          // Wrap rather than bounce: the field should feel endless, not boxed.
          if (p.y < -20) {
            p.y = height + 20;
            p.x = Math.random() * width;
          }
          if (p.x < -20) p.x = width + 20;
          if (p.x > width + 20) p.x = -20;
        }
        draw();
      }
      frame = requestAnimationFrame(step);
    };

    seed();
    draw();
    if (!reduceMotion) frame = requestAnimationFrame(step);

    const onResize = () => {
      seed();
      draw();
    };
    const onPointerMove = (e: PointerEvent) => {
      pointer.tx = e.clientX / window.innerWidth;
      pointer.ty = e.clientY / window.innerHeight;
    };

    const observer = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), { threshold: 0 });
    observer.observe(canvas);

    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className="absolute inset-0 size-full" />;
}
