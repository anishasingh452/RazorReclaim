"use client";

import { Activity } from "lucide-react";
import { PipelineStepper, type StageStatus } from "@/components/pipeline/pipeline-stepper";
import { narrateEvent } from "@/lib/activity-narrative";
import { nodeToPipelineStage, PIPELINE_STAGES, type PipelineStageKey } from "@/lib/pipeline";
import type { BatchStreamEvent } from "@/types/domain";

interface LiveRunPanelProps {
  running: boolean;
  events: BatchStreamEvent[];
  stageCounts: Record<string, number>;
  processed: number;
  total: number;
}

/**
 * The live batch run. Every line here is a genuine execution event streamed
 * from the orchestrator as it happens — there is no replay mode and no
 * pre-baked script, which is exactly why the panel only exists while a run
 * is producing events.
 */
export function LiveRunPanel({ running, events, stageCounts, processed, total }: LiveRunPanelProps) {
  if (!running && events.length === 0) return null;

  // Fold raw graph-node counts into the 8-stage narrative buckets.
  const pipelineCounts: Partial<Record<PipelineStageKey, number>> = {};
  for (const [node, count] of Object.entries(stageCounts)) {
    const stage = nodeToPipelineStage(node);
    if (!stage) continue;
    pipelineCounts[stage] = (pipelineCounts[stage] ?? 0) + count;
  }

  const statuses: Partial<Record<PipelineStageKey, StageStatus>> = {};
  for (const stage of PIPELINE_STAGES) {
    statuses[stage.key] = (pipelineCounts[stage.key] ?? 0) > 0 ? "done" : "pending";
  }
  if (running) {
    const lastStage = events[events.length - 1]?.stage;
    const activeStage = lastStage ? nodeToPipelineStage(lastStage) : null;
    if (activeStage) statuses[activeStage] = "active";
  }

  const percent = total > 0 ? Math.min((processed / total) * 100, 100) : 0;

  return (
    <section className={`glass p-5 ${running ? "beam-ring" : ""}`}>
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex size-7 items-center justify-center rounded-lg border border-blue-500/25 bg-blue-500/10 text-blue-300">
          <Activity className="size-3.5" />
        </span>
        <span className="text-sm font-medium">Agent pipeline</span>
        {running && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium tracking-wider text-emerald-300 uppercase">
            <span className="live-dot" />
            Executing live
          </span>
        )}
        <span className="stat-value ml-auto text-xs text-muted-foreground">
          {processed}
          <span className="text-muted-foreground/40"> / {total} cases</span>
        </span>
      </div>

      <div className="mb-5 h-0.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-emerald-400 shadow-[0_0_12px_oklch(0.77_0.15_165)] transition-[width] duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <PipelineStepper statuses={statuses} counts={pipelineCounts} />

      <div className="inset-panel relative mt-5 h-52 overflow-y-auto p-3">
        {/* Fade the top edge so scrolled content dissolves rather than clips. */}
        <div
          aria-hidden
          className="pointer-events-none sticky top-0 z-10 -mt-3 h-4 bg-gradient-to-b from-black/40 to-transparent"
        />
        <div className="space-y-1 font-mono text-[11.5px]">
          {events
            .slice(-90)
            .reverse()
            .map((event, i) => {
              const line = narrateEvent(event);
              return (
                <div key={`${event.timestamp}-${i}`} className="fade-in flex gap-2.5 leading-snug">
                  <span className="stat-value shrink-0 text-white/25">
                    {new Date(event.timestamp).toLocaleTimeString("en-IN", { hour12: false })}
                  </span>
                  <span className={line.accent}>{line.text}</span>
                </div>
              );
            })}
          {events.length === 0 && <span className="text-white/25">Waiting for the first signal…</span>}
        </div>
      </div>
    </section>
  );
}
