import Link from "next/link";
import { ArrowRight, Ban, ChevronDown, Fingerprint, ScanSearch, Scale, ShieldCheck } from "lucide-react";
import { HeroCanvas } from "@/components/landing/hero-canvas";
import { LandingNav } from "@/components/landing/landing-nav";
import { PipelineLoop } from "@/components/landing/pipeline-loop";
import { Reveal } from "@/components/landing/reveal";
import { getLandingStats } from "@/lib/landing/stats";
import { formatInrCompact } from "@/lib/display";

// The proof strip reads live figures out of the database, so this page is
// rendered per request rather than frozen at build time.
export const dynamic = "force-dynamic";

const PILLARS = [
  {
    icon: ScanSearch,
    title: "Diagnose",
    body: "An LLM reads the gateway, checkout and ledger evidence behind each failure and names the actual cause — not a status code.",
    tone: "text-blue-300 border-blue-500/25 bg-blue-500/10",
  },
  {
    icon: Scale,
    title: "Price",
    body: "A deterministic engine scores every possible action by expected recovery value: recoverable amount × probability − cost. Arithmetic, not vibes.",
    tone: "text-emerald-300 border-emerald-500/25 bg-emerald-500/10",
  },
  {
    icon: Fingerprint,
    title: "Justify",
    body: "Every step is written into a SHA-256 hash chain, re-verified on read. If a record were altered, the page would say so.",
    tone: "text-violet-300 border-violet-500/25 bg-violet-500/10",
  },
];

const DECISIONS = ["ACT", "WAIT", "ESCALATE", "NO ACTION", "STOP"];

const ALTERNATIVES: [string, string][] = [
  ["Payment link", "₹127.98"],
  ["Reminder", "₹74.42"],
  ["Voice call", "₹50.08"],
  ["Escalate", "−₹1,009.01"],
];

export default async function LandingPage() {
  const stats = await getLandingStats();

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white">
      <LandingNav />

      {/* ─────────────  HERO  ───────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 py-28 text-center">
        {/* Ambient stack, back to front: colour blooms, particle field, a
            receding floor grid, then a vignette to hold the centre. */}
        <div aria-hidden className="absolute inset-0">
          <div className="bloom size-[38rem] bg-emerald-500/25" style={{ top: "-12%", left: "8%" }} />
          <div
            className="bloom size-[32rem] bg-blue-600/20"
            style={{ top: "10%", right: "2%", animationDelay: "-7s" }}
          />
          <div
            className="bloom size-[26rem] bg-violet-600/15"
            style={{ bottom: "4%", left: "34%", animationDelay: "-14s" }}
          />
          <HeroCanvas />
          <div className="floor-grid absolute inset-x-[-25%] bottom-0 h-[42vh]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_45%,transparent_10%,rgba(0,0,0,0.72)_100%)]" />
        </div>

        <div className="relative flex max-w-4xl flex-col items-center">
          <span
            className="arrive mb-8 inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] px-3.5 py-1.5 text-[10px] font-medium tracking-[0.2em] text-white/60 uppercase backdrop-blur-sm"
            style={{ "--d": "80ms" } as React.CSSProperties}
          >
            <span className="live-dot" />
            Razorpay Buildathon · AI Revenue Recovery
          </span>

          <h1 className="text-balance">
            <span
              className="arrive title-glow block text-[clamp(2.6rem,8.5vw,6.5rem)] leading-[0.95] font-semibold tracking-[-0.03em]"
              style={{ "--d": "180ms" } as React.CSSProperties}
            >
              Revenue Recovery,
            </span>
            <span
              className="arrive mt-1 block bg-gradient-to-b from-emerald-200 via-emerald-400 to-emerald-600 bg-clip-text text-[clamp(2.6rem,8.5vw,6.5rem)] leading-[0.95] font-semibold tracking-[-0.03em] text-transparent"
              style={{ "--d": "300ms" } as React.CSSProperties}
            >
              Decided by Agents
            </span>
          </h1>

          <p
            className="arrive mt-7 text-[10px] font-medium tracking-[0.28em] text-white/45 uppercase sm:text-[11px]"
            style={{ "--d": "440ms" } as React.CSSProperties}
          >
            Diagnose · Price · Govern · Execute · Prove
          </p>

          <p
            className="arrive mt-6 max-w-2xl text-[15px] leading-relaxed text-balance text-white/60 sm:text-base"
            style={{ "--d": "540ms" } as React.CSSProperties}
          >
            RazorReclaim works every failed payment, abandoned cart, failed subscription and overdue invoice a
            merchant has. It diagnoses the cause, prices every possible response, clears it through policy, then acts
            for real — issuing live Razorpay payment links, emails and voice calls. Or decides, deliberately, to do
            nothing at all.
          </p>

          <div
            className="arrive mt-10 flex flex-col items-center gap-3 sm:flex-row"
            style={{ "--d": "660ms" } as React.CSSProperties}
          >
            <Link
              href="/command-center"
              className="group inline-flex items-center gap-2 rounded-full bg-emerald-400 px-7 py-3.5 text-[15px] font-semibold text-emerald-950 shadow-[0_0_60px_-12px_oklch(0.77_0.15_165)] transition-all hover:bg-emerald-300 hover:shadow-[0_0_80px_-10px_oklch(0.77_0.15_165)]"
            >
              Enter the Command Center
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3.5 text-[15px] font-medium text-white/75 transition-colors hover:border-white/30 hover:text-white"
            >
              How it decides
            </a>
          </div>
        </div>

        <a
          href="#how"
          aria-label="Scroll to how it works"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 transition-colors hover:text-white/70"
        >
          <ChevronDown className="scroll-cue size-5" />
        </a>
      </section>

      {/* ─────────────  PILLARS  ───────────── */}
      <section id="how" className="relative mx-auto max-w-6xl scroll-mt-20 px-5 py-28 md:px-8">
        <Reveal>
          <p className="micro-label text-emerald-400">What it actually does</p>
          <h2 className="mt-4 max-w-2xl text-[clamp(1.9rem,4.6vw,3.2rem)] leading-[1.05] font-semibold tracking-[-0.02em] text-balance">
            Three independent minds on every rupee.
          </h2>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/55">
            An LLM proposes. A deterministic value engine decides. Policy holds the line. When they disagree, the
            product shows you the disagreement instead of hiding it behind one confident answer.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {PILLARS.map((pillar, i) => (
            <Reveal key={pillar.title} delay={i * 120}>
              <div className="glass glass-hover h-full p-6">
                <span className={`flex size-9 items-center justify-center rounded-xl border ${pillar.tone}`}>
                  <pillar.icon className="size-4" />
                </span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">{pillar.title}</h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-white/55">{pillar.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─────────────  PIPELINE  ───────────── */}
      <section className="relative overflow-hidden py-28">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="hairline absolute inset-x-0 top-0 h-px" />
          <div className="absolute top-1/2 left-1/2 size-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.055] blur-[130px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-5 md:px-8">
          <Reveal className="text-center">
            <p className="micro-label text-emerald-400">The lifecycle</p>
            <h2 className="mx-auto mt-4 max-w-2xl text-[clamp(1.9rem,4.6vw,3.2rem)] leading-[1.05] font-semibold tracking-[-0.02em] text-balance">
              Eight stages. Every case. Streamed live.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-white/55">
              Nothing here is a replay. Press run and the graph executes in front of you, one event at a time, across
              a hundred cases at once.
            </p>
          </Reveal>

          <Reveal delay={160} className="mt-16">
            <div className="glass px-6 py-10">
              <PipelineLoop />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─────────────  RESTRAINT  ───────────── */}
      <section className="relative mx-auto max-w-6xl px-5 py-28 md:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <span className="flex size-11 items-center justify-center rounded-2xl border border-amber-500/25 bg-amber-500/10 text-amber-300">
              <Ban className="size-5" strokeWidth={1.5} />
            </span>
            <h2 className="mt-6 text-[clamp(1.9rem,4.6vw,3.2rem)] leading-[1.05] font-semibold tracking-[-0.02em] text-balance">
              The hardest decision is not acting.
            </h2>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-white/55">
              Any tool can send another reminder. RazorReclaim also argues the other side: this customer already
              promised to pay, this one has been contacted three times, this failure will resolve itself. Every
              decision to stay silent is recorded with its reason and the alternatives it priced and rejected.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {DECISIONS.map((decision) => (
                <span
                  key={decision}
                  className="rounded-full border border-white/[0.12] bg-white/[0.03] px-3.5 py-1.5 text-[11px] font-medium tracking-[0.12em] text-white/65"
                >
                  {decision}
                </span>
              ))}
            </div>
          </Reveal>

          <Reveal delay={140}>
            <div className="glass relative overflow-hidden p-6 shadow-[0_0_80px_-50px_oklch(0.8_0.16_85)]">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-20 -left-16 size-56 rounded-full bg-amber-400/[0.08] blur-3xl"
              />
              <div className="relative">
                <p className="micro-label text-amber-300/80">Why not to act</p>
                <p className="mt-3 text-lg font-semibold tracking-tight">Active promise-to-pay</p>
                <p className="mt-2.5 text-[14px] leading-relaxed text-white/55">
                  Customer already committed to ₹1,664.78 by 5 Sept — contacting again now would contradict that
                  promise rather than support it.
                </p>
                <div className="mt-6 space-y-2">
                  <p className="micro-label">Alternatives priced first</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ALTERNATIVES.map(([label, value]) => (
                      <span
                        key={label}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-[11px]"
                      >
                        <span className="text-white/65">{label}</span>
                        <span className={`stat-value ${value.startsWith("−") ? "text-red-300/80" : "text-white/50"}`}>
                          {value}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─────────────  LIVE PROOF  ───────────── */}
      {stats && (
        <section className="relative border-y border-white/[0.06] bg-white/[0.015] py-20">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <Reveal className="mb-12 text-center">
              <p className="micro-label text-emerald-400">Live from the database</p>
              <h2 className="mx-auto mt-4 max-w-xl text-[clamp(1.6rem,3.6vw,2.4rem)] leading-tight font-semibold tracking-[-0.02em] text-balance">
                Not a mockup. These numbers are read at page load.
              </h2>
            </Reveal>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { label: "Cases decided", value: stats.casesDecided.toLocaleString("en-IN"), accent: "text-white" },
                { label: "Revenue at risk", value: formatInrCompact(stats.amountAtRisk), accent: "text-white" },
                { label: "Recovered", value: formatInrCompact(stats.amountRecovered), accent: "text-emerald-300" },
                {
                  label: "Hash-linked events",
                  value: stats.chainedAuditEvents.toLocaleString("en-IN"),
                  accent: "text-violet-300",
                },
              ].map((stat, i) => (
                <Reveal key={stat.label} delay={i * 90}>
                  <div className="text-center">
                    <div className={`stat-value text-[clamp(1.6rem,4vw,2.6rem)] font-semibold ${stat.accent}`}>
                      {stat.value}
                    </div>
                    <div className="micro-label mt-2">{stat.label}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─────────────  CTA  ───────────── */}
      <section className="relative overflow-hidden px-5 py-32 text-center">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute bottom-0 left-1/2 size-[40rem] -translate-x-1/2 translate-y-1/3 rounded-full bg-emerald-500/[0.09] blur-[120px]" />
        </div>

        <Reveal className="relative mx-auto max-w-3xl">
          <span className="mx-auto flex size-11 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
            <ShieldCheck className="size-5" strokeWidth={1.5} />
          </span>
          <h2 className="mt-7 text-[clamp(2rem,5.5vw,3.8rem)] leading-[1.02] font-semibold tracking-[-0.03em] text-balance">
            Watch it decide, live.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-white/55">
            Seed a batch of at-risk revenue, press run, and follow every diagnosis, price, guardrail and execution as
            it happens.
          </p>
          <Link
            href="/command-center"
            className="group mt-10 inline-flex items-center gap-2 rounded-full bg-emerald-400 px-8 py-4 text-base font-semibold text-emerald-950 shadow-[0_0_70px_-14px_oklch(0.77_0.15_165)] transition-all hover:bg-emerald-300"
          >
            Enter the Command Center
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>
      </section>

      <footer className="border-t border-white/[0.06] px-5 py-8 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-[11px] text-white/35">
          <span>RazorReclaim · Agentic revenue recovery</span>
          <span>Razorpay test mode · real payment links, emails and synthesized voice</span>
        </div>
      </footer>
    </div>
  );
}
