"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PipelineStepper, type StageStatus } from "@/components/pipeline/pipeline-stepper";
import { narrateEvent } from "@/lib/activity-narrative";
import { nodeToPipelineStage, PIPELINE_STAGES } from "@/lib/pipeline";
import type { BatchStreamEvent } from "@/types/domain";

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

  // Fold raw node-level counts into the 8-stage narrative buckets.
  const pipelineCounts: Partial<Record<string, number>> = {};
  for (const [node, count] of Object.entries(stageCounts)) {
    const stage = nodeToPipelineStage(node);
    if (!stage) continue;
    pipelineCounts[stage] = (pipelineCounts[stage] ?? 0) + count;
  }
  const statuses: Partial<Record<string, StageStatus>> = {};
  for (const stage of PIPELINE_STAGES) {
    statuses[stage.key] = (pipelineCounts[stage.key] ?? 0) > 0 ? "done" : running ? "pending" : "pending";
  }
  if (running) {
    // Mark the furthest-progressed stage with events as "active" for a live feel.
    const lastEvent = events[events.length - 1];
    const activeStage = lastEvent?.stage ? nodeToPipelineStage(lastEvent.stage) : null;
    if (activeStage) statuses[activeStage] = "active";
  }

  return (
    <Card className="border-white/10 bg-white/[0.02]">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2 font-medium">
          <span className="text-blue-300">AI Recovery Pipeline</span>
          {running && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wide text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              live
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <PipelineStepper statuses={statuses as never} counts={pipelineCounts as never} />

        <ScrollArea className="h-48 rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="space-y-1.5 font-mono text-[11.5px]">
            {events
              .slice(-80)
              .reverse()
              .map((e, i) => {
                const n = narrateEvent(e);
                return (
                  <div key={i} className="flex gap-2.5 leading-snug">
                    <span className="text-zinc-600 shrink-0 tabular-nums">
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={n.accent}>{n.text}</span>
                  </div>
                );
              })}
            {events.length === 0 && <span className="text-zinc-600">Waiting for the first signal…</span>}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
