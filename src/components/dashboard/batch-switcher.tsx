"use client";

import { ChevronDown, Layers } from "lucide-react";
import type { Batch } from "@/types/domain";

/**
 * Batch selector, shared by every batch-scoped page. A styled native select
 * on purpose: it inherits the platform's keyboard handling and mobile
 * picker for free, which a custom popover would have to re-earn.
 */
export function BatchSwitcher({
  batches,
  value,
  onChange,
  className,
}: {
  batches: Batch[];
  value: string | null;
  onChange: (batchId: string) => void;
  className?: string;
}) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <Layers className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground/50" />
      <select
        aria-label="Select batch"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full min-w-56 appearance-none rounded-lg border border-white/10 bg-white/[0.03] pr-8 pl-8 text-[13px] text-foreground transition-colors hover:border-white/20 focus:ring-2 focus:ring-emerald-500/40 focus:outline-none"
      >
        {batches.length === 0 && <option value="">No batches yet</option>}
        {batches.map((b) => (
          <option key={b.id} value={b.id} className="bg-zinc-900">
            {b.name} · {b.total_cases} cases · {b.status}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground/50" />
    </div>
  );
}
