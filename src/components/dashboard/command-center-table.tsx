"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ACTION_COLOR,
  ACTION_LABEL,
  avatarTint,
  confidenceColor,
  formatInrPrecise,
  initials,
  RISK_TYPE_LABEL,
  STATUS_COLOR,
  STATUS_DOT,
  STATUS_LABEL,
} from "@/lib/display";
import type { CaseWithImpact } from "@/types/domain";

export function CommandCenterTable({ cases, loading }: { cases: CaseWithImpact[]; loading: boolean }) {
  if (loading) {
    return <div className="p-10 text-sm text-muted-foreground text-center">Loading cases…</div>;
  }
  if (cases.length === 0) {
    return (
      <div className="p-10 text-sm text-muted-foreground text-center">
        No cases match this filter — create or select a batch to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="text-[11px] uppercase tracking-wide">Customer</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wide">Amount</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wide">Risk</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wide">AI Confidence</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wide">Recommended Action</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wide">Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.map((c) => (
            <TableRow key={c.id} className="border-white/[0.06] hover:bg-white/[0.03] group">
              <TableCell>
                <Link href={`/cases/${c.id}`} className="flex items-center gap-2.5">
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${avatarTint(c.customer_name)}`}
                  >
                    {initials(c.customer_name)}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-foreground group-hover:text-emerald-300 transition-colors">
                      {c.customer_name}
                    </span>
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
                      {c.customer_tier} · {c.contact_attempts} attempt{c.contact_attempts === 1 ? "" : "s"}
                    </span>
                  </span>
                </Link>
              </TableCell>
              <TableCell className="font-mono text-sm tabular-nums">{formatInrPrecise(c.amount)}</TableCell>
              <TableCell>
                <span className="text-xs text-muted-foreground">{RISK_TYPE_LABEL[c.risk_type]}</span>
              </TableCell>
              <TableCell>
                {c.selectedRecoveryProbability !== null ? (
                  <span className={`font-mono text-sm font-medium ${confidenceColor(c.selectedRecoveryProbability)}`}>
                    {(c.selectedRecoveryProbability * 100).toFixed(0)}%
                  </span>
                ) : (
                  <span className="text-muted-foreground/40">—</span>
                )}
              </TableCell>
              <TableCell>
                {c.final_action ? (
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${ACTION_COLOR[c.final_action]}`}
                  >
                    {ACTION_LABEL[c.final_action]}
                  </span>
                ) : (
                  <span className="text-muted-foreground/40">—</span>
                )}
              </TableCell>
              <TableCell>
                <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[c.status]}`}>
                  <span className={`size-1.5 rounded-full ${STATUS_DOT[c.status]}`} />
                  {STATUS_LABEL[c.status]}
                </span>
              </TableCell>
              <TableCell>
                <Link
                  href={`/cases/${c.id}`}
                  className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-emerald-300 transition-colors opacity-0 group-hover:opacity-100"
                >
                  Investigate <ArrowUpRight className="size-3" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
