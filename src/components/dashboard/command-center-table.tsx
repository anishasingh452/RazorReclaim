"use client";

import Link from "next/link";
import { ArrowUpRight, Inbox } from "lucide-react";
import {
  ACTION_COLOR,
  ACTION_LABEL,
  DECISION_CATEGORY_LABEL,
  RISK_TYPE_LABEL,
  STATUS_COLOR,
  STATUS_DOT,
  STATUS_LABEL,
  actionToCategory,
  avatarTint,
  confidenceColor,
  formatInrCompact,
  formatInrPrecise,
  initials,
} from "@/lib/display";
import type { CaseWithImpact } from "@/types/domain";

/**
 * The decision inbox: one row per case, carrying the whole decision at a
 * glance — what it's worth, how likely we are to recover it, what the
 * system decided, and where it stands. Every row is a doorway into the full
 * investigation.
 */
export function CommandCenterTable({ cases, loading }: { cases: CaseWithImpact[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-lg bg-white/[0.03]"
            style={{ animationDelay: `${i * 90}ms` }}
          />
        ))}
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="flex size-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.02] text-muted-foreground/50">
          <Inbox className="size-4.5" />
        </span>
        <p className="text-sm text-muted-foreground">
          No cases match this filter — create or select a batch to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] border-collapse">
        <thead>
          <tr className="border-b border-white/[0.07]">
            {["Customer", "Amount", "Risk", "Recovery odds", "Decision", "Expected value", "Status", ""].map(
              (heading) => (
                <th
                  key={heading}
                  className="micro-label px-4 py-2.5 text-left font-medium whitespace-nowrap last:w-10"
                >
                  {heading}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {cases.map((c, i) => {
            const category = c.final_action ? actionToCategory(c.final_action) : null;
            const odds = c.selectedRecoveryProbability;

            return (
              <tr
                key={c.id}
                className="group border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.03]"
                style={{ "--d": `${Math.min(i * 18, 400)}ms` } as React.CSSProperties}
              >
                <td className="px-4 py-2.5">
                  <Link href={`/cases/${c.id}`} className="flex items-center gap-2.5">
                    <span
                      className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold ${avatarTint(c.customer_name)}`}
                    >
                      {initials(c.customer_name)}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[13px] font-medium transition-colors group-hover:text-emerald-300">
                        {c.customer_name}
                      </span>
                      <span className="micro-label mt-0.5">
                        {c.customer_tier} · {c.contact_attempts} attempt{c.contact_attempts === 1 ? "" : "s"}
                      </span>
                    </span>
                  </Link>
                </td>

                <td className="stat-value px-4 py-2.5 text-[13px] whitespace-nowrap">{formatInrPrecise(c.amount)}</td>

                <td className="px-4 py-2.5">
                  <span className="text-[11.5px] whitespace-nowrap text-muted-foreground">
                    {RISK_TYPE_LABEL[c.risk_type]}
                  </span>
                </td>

                <td className="px-4 py-2.5">
                  {odds !== null ? (
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-white/[0.07]">
                        <span
                          className="block h-full rounded-full transition-[width] duration-700"
                          style={{
                            width: `${Math.max(odds * 100, 3)}%`,
                            background:
                              odds >= 0.7
                                ? "oklch(0.77 0.15 165)"
                                : odds >= 0.4
                                  ? "oklch(0.8 0.16 85)"
                                  : "oklch(0.65 0.2 25)",
                          }}
                        />
                      </span>
                      <span className={`stat-value text-[12px] font-medium ${confidenceColor(odds)}`}>
                        {(odds * 100).toFixed(0)}%
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground/30">—</span>
                  )}
                </td>

                <td className="px-4 py-2.5">
                  {c.final_action ? (
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${ACTION_COLOR[c.final_action]}`}
                      >
                        {ACTION_LABEL[c.final_action]}
                      </span>
                      {category && (
                        <span className="micro-label hidden lg:inline">{DECISION_CATEGORY_LABEL[category]}</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/30">—</span>
                  )}
                </td>

                <td className="px-4 py-2.5">
                  {c.selectedExpectedRecoveryValue !== null ? (
                    <span
                      className={`stat-value text-[13px] ${
                        c.selectedExpectedRecoveryValue > 0 ? "text-emerald-300/90" : "text-muted-foreground"
                      }`}
                    >
                      {formatInrCompact(c.selectedExpectedRecoveryValue)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/30">—</span>
                  )}
                </td>

                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${STATUS_COLOR[c.status]}`}
                  >
                    <span className={`size-1.5 rounded-full ${STATUS_DOT[c.status]}`} />
                    {STATUS_LABEL[c.status]}
                  </span>
                </td>

                <td className="px-4 py-2.5">
                  <Link
                    href={`/cases/${c.id}`}
                    aria-label={`Investigate ${c.customer_name}`}
                    className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground/40 opacity-0 transition-all group-hover:opacity-100 hover:bg-white/[0.06] hover:text-emerald-300 focus-visible:opacity-100"
                  >
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
