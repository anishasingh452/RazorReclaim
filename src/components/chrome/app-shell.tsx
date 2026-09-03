import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { TopNav } from "./top-nav";

/**
 * The persistent frame every page sits in: ambient depth layers behind, a
 * frosted command bar above. Purely presentational and server-rendered —
 * only the nav (which needs the current route) is a client component.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Ambient field. Fixed, pointer-events-none, and behind everything:
          a faint engineering grid over the body's aurora gradients, with a
          horizon glow along the top edge where the command bar sits. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 grid-field" />
        <div className="absolute inset-x-0 top-0 h-px hairline" />
        <div className="absolute -top-40 left-1/2 h-80 w-[52rem] -translate-x-1/2 rounded-full bg-emerald-500/[0.07] blur-[100px]" />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1500px] items-center gap-6 px-5 md:px-8">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="relative flex size-6 items-center justify-center rounded-md border border-emerald-500/25 bg-emerald-500/10">
              <span className="live-dot" />
            </span>
            <span className="text-sm font-semibold tracking-tight">
              Razor<span className="text-emerald-400">Reclaim</span>
            </span>
          </Link>

          <div className="h-5 w-px bg-white/10" />

          <TopNav />

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase md:inline-flex">
              <ShieldCheck className="size-3 text-emerald-400/70" />
              Razorpay Test Mode
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 py-1 text-[10px] font-medium tracking-wider whitespace-nowrap text-emerald-300 uppercase">
              <span className="live-dot" />
              <span className="hidden sm:inline">Agents online</span>
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </>
  );
}
