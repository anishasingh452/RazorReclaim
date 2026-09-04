"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** useLayoutEffect warns during SSR; fall back to useEffect on the server. */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface CountUpProps {
  value: number;
  format: (n: number) => string;
  /** Milliseconds for the full sweep. */
  duration?: number;
  className?: string;
}

/**
 * Counts a metric up from zero when it first appears, and eases between
 * values when the number changes mid-run (batch KPIs update live while a
 * batch executes — a hard jump would read as a glitch rather than progress).
 * Renders the final formatted value on the server so there's no hydration
 * mismatch and no layout shift.
 */
export function CountUp({ value, format, duration = 900, className }: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  useIsoLayoutEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    // Respect the OS-level motion preference: land on the value immediately.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      fromRef.current = to;
      setDisplay(to);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 4); // easeOutQuart — fast start, soft landing
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    frameRef.current = requestAnimationFrame(tick);

    /**
     * Animation frames are a courtesy, not a guarantee: browsers suspend rAF
     * for backgrounded tabs and throttle it under load. Without this, a
     * KPI whose sweep began but never got another frame would sit at ~0
     * indefinitely — reporting "₹0 recovered" for a batch that recovered
     * real money. A timer (which still fires when throttled) guarantees the
     * true figure lands regardless of how the sweep went.
     */
    const settle = setTimeout(() => {
      fromRef.current = to;
      setDisplay(to);
    }, duration + 250);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      clearTimeout(settle);
      fromRef.current = to;
    };
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
}
