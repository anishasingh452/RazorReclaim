"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { BatchStreamEvent } from "@/types/domain";

const STAGE_ORDER = [
  "queued",
  "detect",
  "root_cause",
  "recommend",
  "business_impact",
  "policy",
  "execute",
  "verify",
  "escalate",
  "stop",
  "defer",
] as const;

const STAGE_LABEL: Record<string, string> = {
  queued: "Queued",
  detect: "Detect",
  root_cause: "Diagnose",
  recommend: "Recommend",
  business_impact: "Prioritize",
  policy: "Policy Check",
  execute: "Execute",
  verify: "Verify",
  escalate: "Escalated",
  stop: "Stopped",
  defer: "Deferred",
};

export function LiveRunPanel({
  running,
  events,
  stageCounts,
}: {
  running: boolean;
  events: BatchStreamEvent[];
  stageCounts: Record<string, number>;
}) {
  if (!running && events.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          Live Agent Workflow
          {running && (
            <span className="inline-flex items-center gap-1 text-xs font-normal text-emerald-600">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              running
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {STAGE_ORDER.map((stage) => (
            <div
              key={stage}
              className="flex items-center gap-1.5 rounded-md border bg-white px-2.5 py-1.5 text-xs"
            >
              <span className="text-neutral-500">{STAGE_LABEL[stage]}</span>
              <Badge variant="secondary" className="tabular-nums px-1.5 py-0 min-w-5 justify-center">
                {stageCounts[stage] ?? 0}
              </Badge>
            </div>
          ))}
        </div>

        <ScrollArea className="h-40 rounded-md border bg-neutral-50 p-2">
          <div className="space-y-1 font-mono text-[11px] text-neutral-600">
            {events
              .slice(-60)
              .reverse()
              .map((e, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-neutral-400 shrink-0">
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="truncate">
                    {e.caseId ? `case ${e.caseId.slice(0, 8)}` : "batch"} → {STAGE_LABEL[e.stage ?? ""] ?? e.stage}{" "}
                    {e.status}
                  </span>
                </div>
              ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
