"use client";

import Link from "next/link";
import { Bot, Gauge, GitBranch, ListChecks, ShieldCheck, Target, TrendingUp } from "lucide-react";
import { CountUp } from "@/components/viz/count-up";
import { formatInrCompact } from "@/lib/display";
import type { BatchDetail } from "@/lib/api-client";

interface KpiCardsProps {
  detail: BatchDetail | null;
  conflictCount: number;
}

/**
 * The batch's vital signs. Values count up on arrival and ease between
 * updates while a run streams, so the numbers read as a system working
 * rather than a table refreshing.
 */
export function KpiCards({ detail, conflictCount }: KpiCardsProps) {
  const b = detail?.batch;
  const atRisk = b?.total_at_risk ?? 0;
  const recovered = b?.total_recovered ?? 0;
  const erv = b?.total_expected_recovery_value ?? 0;
  const recoveryRate = atRisk > 0 ? (recovered / atRisk) * 100 : 0;
  const totalCases = detail?.totalCases ?? 0;
  // "Processed" means the graph finished with it. A case that has left `open`
  // is merely picked up — counting those would show 6/6 the instant a run
  // starts, which is worse than useless during a live demo.
  const processed = totalCases - (detail?.statusBreakdown.open ?? 0) - (detail?.statusBreakdown.in_progress ?? 0);
  const decisionsExecuted = Object.values(detail?.actionBreakdown ?? {}).reduce((s, n) => s + n, 0);

  const cards = [
    {
      label: "Revenue at risk",
      value: atRisk,
      format: formatInrCompact,
      icon: Target,
      accent: "text-foreground",
      bar: null,
      progress: null,
    },
    {
      label: "Revenue recovered",
      value: recovered,
      format: formatInrCompact,
      icon: TrendingUp,
      accent: "text-emerald-300",
      bar: "oklch(0.74 0.12 168)",
      progress: atRisk > 0 ? recovered / atRisk : 0,
    },
    {
      label: "Recovery rate",
      value: recoveryRate,
      format: (n: number) => `${n.toFixed(1)}%`,
      icon: Gauge,
      accent: "text-emerald-300",
      bar: "oklch(0.74 0.12 168)",
      progress: recoveryRate / 100,
    },
    {
      label: "Expected value",
      value: erv,
      format: formatInrCompact,
      icon: ShieldCheck,
      accent: "text-sky-200",
      bar: null,
      progress: null,
    },
    {
      label: "Cases processed",
      value: processed,
      format: (n: number) => `${Math.round(n)}/${totalCases}`,
      icon: ListChecks,
      accent: "text-foreground",
      bar: "oklch(0.68 0.085 245)",
      progress: totalCases > 0 ? processed / totalCases : 0,
    },
    {
      label: "Decisions made",
      value: decisionsExecuted,
      format: (n: number) => String(Math.round(n)),
      icon: Bot,
      accent: "text-indigo-200",
      bar: null,
      progress: null,
    },
  ];

  return (
    <div className="grid auto-rows-fr grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
      {cards.map((card, i) => (
        <div
          key={card.label}
          className="rise glass glass-hover sweep relative flex flex-col p-3.5"
          style={{ "--d": `${i * 55}ms` } as React.CSSProperties}
        >
          <div className="mb-2.5 flex items-start justify-between gap-2">
            <span className="micro-label leading-snug">{card.label}</span>
            <card.icon className="size-3.5 shrink-0 text-muted-foreground/40" />
          </div>
          <div className={`stat-value mt-auto text-xl font-semibold ${card.accent}`}>
            <CountUp value={card.value} format={card.format} />
          </div>
          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.05]">
            {card.progress !== null && (
              <div
                className="h-full rounded-full transition-[width] duration-1000 ease-out"
                style={{
                  width: `${Math.min(Math.max(card.progress * 100, 0), 100)}%`,
                  background: card.bar ?? "oklch(1 0 0 / 0.3)",
                }}
              />
            )}
          </div>
        </div>
      ))}

      {/* Governance is a first-class metric here, not a detail buried inside
          a case: how often the two agents disagreed across the whole batch. */}
      <Link
        href="/conflicts"
        className="rise glass glass-hover sweep relative flex flex-col p-3.5"
        style={{ "--d": "330ms" } as React.CSSProperties}
      >
        <div className="mb-2.5 flex items-start justify-between gap-2">
          <span className="micro-label leading-snug">Agent conflicts</span>
          <GitBranch className="size-3.5 shrink-0 text-muted-foreground/40" />
        </div>
        <div
          className={`stat-value mt-auto text-xl font-semibold ${conflictCount > 0 ? "text-amber-300" : "text-foreground"}`}
        >
          <CountUp value={conflictCount} format={(n) => String(Math.round(n))} />
        </div>
        <div className="mt-2.5 h-1 text-[10px] leading-none text-muted-foreground/60">Resolved by ERV →</div>
      </Link>
    </div>
  );
}
