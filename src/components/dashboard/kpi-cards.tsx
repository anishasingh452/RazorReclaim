import { TrendingUp, ShieldCheck, Target, Gauge, ListChecks, Bot } from "lucide-react";
import { formatInrCompact } from "@/lib/display";
import type { BatchDetail } from "@/lib/api-client";

export function KpiCards({ detail }: { detail: BatchDetail | null }) {
  const b = detail?.batch;
  const atRisk = b?.total_at_risk ?? 0;
  const recovered = b?.total_recovered ?? 0;
  const erv = b?.total_expected_recovery_value ?? 0;
  const recoveryRate = atRisk > 0 ? (recovered / atRisk) * 100 : 0;
  const totalCases = detail?.totalCases ?? 0;
  const processed = totalCases - (detail?.statusBreakdown.open ?? 0);
  const decisionsExecuted = Object.entries(detail?.actionBreakdown ?? {}).reduce((s, [, n]) => s + n, 0);

  const cards = [
    { label: "Revenue At Risk", value: formatInrCompact(atRisk), icon: Target, accent: "text-zinc-200" },
    { label: "Revenue Recovered", value: formatInrCompact(recovered), icon: TrendingUp, accent: "text-emerald-400" },
    { label: "Recovery Rate", value: `${recoveryRate.toFixed(1)}%`, icon: Gauge, accent: "text-emerald-400" },
    { label: "Expected Recovery Value", value: formatInrCompact(erv), icon: ShieldCheck, accent: "text-blue-300", sub: "ERV-selected actions" },
    { label: "Cases Processed", value: `${processed}/${totalCases}`, icon: ListChecks, accent: "text-zinc-200" },
    { label: "AI Decisions Executed", value: String(decisionsExecuted), icon: Bot, accent: "text-violet-300" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="group relative rounded-xl border border-white/10 bg-white/[0.03] p-4 overflow-hidden transition-colors hover:border-white/20"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{c.label}</span>
            <c.icon className="size-3.5 text-muted-foreground/50" />
          </div>
          <div className={`text-2xl font-semibold tabular-nums font-mono ${c.accent}`}>{c.value}</div>
          {c.sub && <div className="text-[10px] text-muted-foreground/70 mt-1">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}
