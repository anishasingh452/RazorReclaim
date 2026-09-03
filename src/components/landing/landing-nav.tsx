"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

/** Transparent over the hero, frosted once you leave it. */
export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled ? "border-b border-white/[0.06] bg-black/70 backdrop-blur-xl" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-5 md:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="relative flex size-6 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10">
            <span className="live-dot" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            Razor<span className="text-emerald-400">Reclaim</span>
          </span>
        </Link>

        <Link
          href="/command-center"
          className="group inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-[13px] font-medium text-white/90 backdrop-blur-sm transition-all hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-300"
        >
          Enter Command Center
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </header>
  );
}
