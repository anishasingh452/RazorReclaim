"use client";

import Link from "next/link";
import { ArrowUpRight, Brain, TriangleAlert } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  ACTION_COLOR,
  ACTION_LABEL,
  RISK_TYPE_LABEL,
  formatInrPrecise,
  timeAgo,
} from "@/lib/display";
import type { CustomerHistoryEntry, PromiseToPay } from "@/types/domain";

/**
 * Shared Agent Memory for one customer — the cross-case record every agent
 * consults before proposing anything. Presented as a drawer rather than a
 * page: it's context for the case you're already looking at, and navigating
 * away to read it would lose your place.
 */
export function CustomerMemory({
  customerName,
  history,
  activePromise,
}: {
  customerName: string;
  history: CustomerHistoryEntry[];
  activePromise: PromiseToPay | null;
}) {
  const recovered = history.filter((h) => h.verified).length;

  return (
    <div className="glass flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-violet-500/25 bg-violet-500/10 text-violet-300">
        <Brain className="size-3.5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="micro-label">Shared agent memory</div>
        <div className="mt-0.5 truncate text-[13px] text-muted-foreground">
          {history.length === 0 ? (
            <>No prior recovery history — this is their first case.</>
          ) : (
            <>
              <span className="text-foreground/85">
                {history.length} prior case{history.length === 1 ? "" : "s"}
              </span>
              {recovered > 0 && <span className="text-emerald-300/80"> · {recovered} recovered</span>}
              <span className="text-muted-foreground/70"> · {history[0].summary}</span>
            </>
          )}
        </div>
      </div>

      {activePromise && (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-300">
          <TriangleAlert className="size-3" />
          Active promise · {formatInrPrecise(activePromise.promised_amount)}
        </span>
      )}

      {history.length > 0 && (
        <Sheet>
          <SheetTrigger className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground">
            Full history
            <ArrowUpRight className="size-3" />
          </SheetTrigger>
          <SheetContent className="w-full border-white/10 bg-background/95 backdrop-blur-xl sm:max-w-md">
            <SheetHeader className="border-b border-white/[0.06] p-5">
              <SheetTitle>{customerName}</SheetTitle>
              <SheetDescription>
                Everything the agents remember about this customer, across every case.
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-2.5 overflow-y-auto p-5 pt-2">
              {activePromise && (
                <div className="inset-panel border-amber-500/20 bg-amber-500/[0.06] p-3">
                  <div className="micro-label mb-1 text-amber-300/80">Active commitment</div>
                  <div className="text-sm text-foreground/90">
                    Promised {formatInrPrecise(activePromise.promised_amount)} by{" "}
                    {new Date(activePromise.promised_date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    While this stands, the Communication Governor blocks further outreach.
                  </p>
                </div>
              )}

              {history.map((entry, i) => (
                <Link
                  key={entry.id}
                  href={`/cases/${entry.case_id}`}
                  className="rise glass glass-hover block p-3.5"
                  style={{ "--d": `${i * 50}ms` } as React.CSSProperties}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {entry.final_action && (
                      <span
                        className={`inline-flex items-center rounded border px-1.5 py-0 text-[10px] font-medium ${ACTION_COLOR[entry.final_action]}`}
                      >
                        {ACTION_LABEL[entry.final_action]}
                      </span>
                    )}
                    {entry.case_risk_type && (
                      <span className="text-[10.5px] text-muted-foreground/70">
                        {RISK_TYPE_LABEL[entry.case_risk_type]}
                      </span>
                    )}
                    <span className="stat-value ml-auto text-[10px] text-muted-foreground/50">
                      {timeAgo(entry.created_at)}
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{entry.summary}</p>

                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded border px-1.5 py-0 text-[10px] font-medium ${
                        entry.verified
                          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                          : "border-white/10 bg-white/[0.03] text-zinc-400"
                      }`}
                    >
                      {entry.verified ? "Verified recovery" : "Not recovered"}
                    </span>
                    {entry.amount_recovered > 0 && (
                      <span className="stat-value text-[11px] text-emerald-300">
                        {formatInrPrecise(entry.amount_recovered)}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
