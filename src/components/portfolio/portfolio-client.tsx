"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Flame, Layers, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { BatchSwitcher } from "@/components/dashboard/batch-switcher";
import { fetchBatches, fetchPortfolio } from "@/lib/api-client";
import {
  ACTION_COLOR,
  ACTION_LABEL,
  RISK_TYPE_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
  avatarTint,
  confidenceColor,
  formatInrCompact,
  formatInrPrecise,
  initials,
} from "@/lib/display";
import type { Batch, RankedPortfolioOpportunity } from "@/types/domain";

/** Older cases read hotter — the recovery window is visibly closing. */
function ageTone(days: number): string {
  if (days >= 45) return "text-red-300";
  if (days >= 21) return "text-amber-300";
  return "text-muted-foreground";
}

export function PortfolioClient() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<RankedPortfolioOpportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBatches()
      .then((data) => {
        setBatches(data);
        if (data.length > 0) setBatchId((current) => current ?? data[0].id);
        else setLoading(false);
      })
      .catch((err) => {
        toast.error(String(err));
        setLoading(false);
      });
  }, []);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      setOpportunities(await fetchPortfolio(id));
    } catch (err) {
      toast.error(String(err));
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-batch-change
    if (batchId) load(batchId);
  }, [batchId, load]);

  const topTen = opportunities.slice(0, 10);
  const topErv = topTen.reduce((sum, o) => sum + o.selectedErv, 0);
  const avgAge = topTen.length > 0 ? topTen.reduce((s, o) => s + o.daysSinceFailure, 0) / topTen.length : 0;
  const maxScore = Math.max(...opportunities.map((o) => o.priorityScore), 1);

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-5 py-8 md:px-8">
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.18em] text-emerald-400 uppercase">
            <TrendingUp className="size-3" />
            Portfolio optimization
          </div>
          <h1 className="text-luminous text-3xl font-semibold tracking-tight">Priority Queue</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Ranked by where the next action creates the most recoverable value — expected value weighted by how fast
            each case&apos;s recovery window is closing, not simply by amount.
          </p>
        </div>
        <BatchSwitcher batches={batches} value={batchId} onChange={setBatchId} />
      </div>

      {opportunities.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MiniStat icon={<Layers className="size-3.5" />} label="Ranked opportunities" value={String(opportunities.length)} delay={0} />
          <MiniStat
            icon={<TrendingUp className="size-3.5" />}
            label="Expected value · top 10"
            value={formatInrCompact(topErv)}
            accent="text-emerald-300"
            delay={60}
          />
          <MiniStat
            icon={<Flame className="size-3.5" />}
            label="Avg age · top 10"
            value={`${avgAge.toFixed(0)} days`}
            accent={avgAge >= 30 ? "text-amber-300" : undefined}
            delay={120}
          />
        </div>
      )}

      <section className="rise glass" style={{ "--d": "160ms" } as React.CSSProperties}>
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-11 animate-pulse rounded-lg bg-white/[0.03]" />
            ))}
          </div>
        ) : opportunities.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              {batches.length === 0
                ? "No batches yet — seed one from the Command Center to see a ranking."
                : "Nothing prioritized yet. Run this batch from the Command Center first."}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground"
            >
              Go to Command Center <ArrowUpRight className="size-3" />
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[54rem] border-collapse">
              <thead>
                <tr className="border-b border-white/[0.07]">
                  {["#", "Customer", "Risk", "Amount", "Age", "Odds", "Decision", "Priority score"].map((h) => (
                    <th key={h} className="micro-label px-4 py-2.5 text-left font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {opportunities.map((o, i) => (
                  <tr
                    key={o.caseId}
                    className="group border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-2.5">
                      <span
                        className={`stat-value text-[13px] font-semibold ${
                          i < 3 ? "text-emerald-300" : "text-muted-foreground/50"
                        }`}
                      >
                        {i + 1}
                      </span>
                    </td>

                    <td className="px-4 py-2.5">
                      <Link href={`/cases/${o.caseId}`} className="flex items-center gap-2.5">
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold ${avatarTint(o.customerName)}`}
                        >
                          {initials(o.customerName)}
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-[13px] font-medium transition-colors group-hover:text-emerald-300">
                            {o.customerName}
                          </span>
                          <span className="micro-label mt-0.5">{o.customerTier}</span>
                        </span>
                      </Link>
                    </td>

                    <td className="px-4 py-2.5 text-[11.5px] whitespace-nowrap text-muted-foreground">
                      {RISK_TYPE_LABEL[o.riskType]}
                    </td>

                    <td className="stat-value px-4 py-2.5 text-[13px] whitespace-nowrap">
                      {formatInrPrecise(o.amount)}
                    </td>

                    <td className={`stat-value px-4 py-2.5 text-[12.5px] whitespace-nowrap ${ageTone(o.daysSinceFailure)}`}>
                      {o.daysSinceFailure}d
                    </td>

                    <td className={`stat-value px-4 py-2.5 text-[12.5px] ${confidenceColor(o.recoveryProbability)}`}>
                      {(o.recoveryProbability * 100).toFixed(0)}%
                    </td>

                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        {o.finalAction ? (
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${ACTION_COLOR[o.finalAction]}`}
                          >
                            {ACTION_LABEL[o.finalAction]}
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[o.status]}`}
                          >
                            {STATUS_LABEL[o.status]}
                          </span>
                        )}
                      </span>
                    </td>

                    {/* The ranking ladder: score value sitting on a heat bar
                        so relative priority is readable without comparing digits. */}
                    <td className="px-4 py-2.5">
                      <div className="relative flex h-7 min-w-32 items-center overflow-hidden rounded-md bg-white/[0.03] px-2">
                        <div
                          className="absolute inset-y-0 left-0 rounded-md transition-[width] duration-700"
                          style={{
                            width: `${Math.max((o.priorityScore / maxScore) * 100, 2)}%`,
                            background: "linear-gradient(90deg, oklch(0.77 0.15 165 / 0.15), oklch(0.77 0.15 165 / 0.5))",
                          }}
                        />
                        <span className="stat-value relative text-[12.5px] font-semibold text-emerald-200">
                          {formatInrCompact(o.priorityScore)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  accent,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
  delay: number;
}) {
  return (
    <div className="rise glass glass-hover p-4" style={{ "--d": `${delay}ms` } as React.CSSProperties}>
      <div className="mb-2 flex items-center justify-between">
        <span className="micro-label">{label}</span>
        <span className="text-muted-foreground/40">{icon}</span>
      </div>
      <div className={`stat-value text-xl font-semibold ${accent ?? "text-foreground"}`}>{value}</div>
    </div>
  );
}
