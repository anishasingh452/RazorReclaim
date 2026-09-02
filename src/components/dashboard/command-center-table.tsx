"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ACTION_COLOR,
  ACTION_LABEL,
  formatInrPrecise,
  RISK_TYPE_COLOR,
  RISK_TYPE_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
} from "@/lib/display";
import type { Case } from "@/types/domain";

export function CommandCenterTable({ cases, loading }: { cases: Case[]; loading: boolean }) {
  if (loading) {
    return <div className="p-8 text-sm text-neutral-400 text-center">Loading cases…</div>;
  }
  if (cases.length === 0) {
    return <div className="p-8 text-sm text-neutral-400 text-center">No cases yet — create or select a batch.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Risk Type</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Attempts</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.customer_name}</TableCell>
              <TableCell className="tabular-nums">{formatInrPrecise(c.amount)}</TableCell>
              <TableCell>
                <Badge variant="outline" className={RISK_TYPE_COLOR[c.risk_type]}>
                  {RISK_TYPE_LABEL[c.risk_type]}
                </Badge>
              </TableCell>
              <TableCell className="uppercase text-xs text-neutral-500">{c.customer_tier}</TableCell>
              <TableCell className="tabular-nums text-neutral-500">{c.contact_attempts}</TableCell>
              <TableCell>
                {c.final_action ? (
                  <Badge className={ACTION_COLOR[c.final_action]}>{ACTION_LABEL[c.final_action]}</Badge>
                ) : (
                  <span className="text-neutral-300">—</span>
                )}
              </TableCell>
              <TableCell>
                <Badge className={STATUS_COLOR[c.status]}>{STATUS_LABEL[c.status]}</Badge>
              </TableCell>
              <TableCell>
                <Link href={`/cases/${c.id}`} className="text-xs text-blue-600 hover:underline">
                  Investigate
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
