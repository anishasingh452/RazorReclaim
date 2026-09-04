import { PIPELINE_STAGES, type PipelineStageKey } from "@/lib/pipeline";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type StageStatus = "done" | "active" | "pending" | "skipped";

const NODE_CLASS: Record<StageStatus, string> = {
  done: "bg-emerald-400 ring-[3px] ring-emerald-400/15",
  active: "bg-sky-300 ring-[4px] ring-sky-300/20",
  pending: "bg-white/15 ring-[3px] ring-white/[0.04]",
  skipped: "bg-white/[0.08] ring-[3px] ring-white/[0.02]",
};

const LABEL_CLASS: Record<StageStatus, string> = {
  done: "text-foreground/85",
  active: "text-sky-200",
  pending: "text-muted-foreground/70",
  skipped: "text-muted-foreground/35 line-through decoration-white/20",
};

/**
 * The 8-stage recovery pipeline as an illuminated rail: nodes light up as
 * they complete, the segment currently being worked carries a travelling
 * pulse, and stages the run skipped stay visible but struck through — the
 * shape of the whole process is legible even mid-run.
 *
 * Shared by the live batch view (aggregate, event-driven) and the case page
 * (single case, derived from stored data), so both speak the same visual
 * language for "where are we."
 */
export function PipelineStepper({
  statuses,
  counts,
}: {
  statuses: Partial<Record<PipelineStageKey, StageStatus>>;
  counts?: Partial<Record<PipelineStageKey, number>>;
}) {
  return (
    <div className="flex w-full items-start overflow-x-auto pb-1">
      {PIPELINE_STAGES.map((stage, i) => {
        const status = statuses[stage.key] ?? "pending";
        const next = statuses[PIPELINE_STAGES[i + 1]?.key] ?? "pending";
        const count = counts?.[stage.key];
        const isLast = i === PIPELINE_STAGES.length - 1;

        // The connector reflects the transition INTO the next stage: solid
        // emerald once both ends are done, a travelling pulse while the next
        // stage is being worked, otherwise inert.
        const connectorDone = status === "done" && (next === "done" || next === "skipped");
        const connectorActive = status === "done" && next === "active";

        return (
          <div key={stage.key} className="flex min-w-0 flex-1 items-start last:flex-none">
            <Tooltip>
              <TooltipTrigger className="flex w-[4.5rem] shrink-0 cursor-default flex-col items-center gap-2 sm:w-auto sm:min-w-[5rem]">
                <span className="relative flex h-3 items-center">
                  <span className={`size-2.5 rounded-full transition-all duration-500 ${NODE_CLASS[status]}`} />
                  {status === "active" && (
                    <span className="absolute inset-0 m-auto size-2.5 animate-ping rounded-full bg-sky-300/40" />
                  )}
                </span>
                <span className="flex flex-col items-center gap-0.5">
                  <span
                    className={`text-center text-[10.5px] leading-tight font-medium tracking-tight transition-colors sm:whitespace-nowrap ${LABEL_CLASS[status]}`}
                  >
                    {stage.label}
                  </span>
                  {typeof count === "number" && count > 0 && (
                    <span className="stat-value text-[10px] text-emerald-400/70">{count}</span>
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent>{stage.hint}</TooltipContent>
            </Tooltip>

            {!isLast && (
              <span
                className={`mt-[5px] h-px min-w-4 flex-1 rounded-full transition-colors duration-500 ${
                  connectorDone
                    ? "bg-gradient-to-r from-emerald-400/50 to-emerald-400/25"
                    : connectorActive
                      ? "stream bg-sky-300/12"
                      : "bg-white/[0.07]"
                }`}
                style={connectorActive ? ({ "--stream-color": "oklch(0.68 0.085 245)" } as React.CSSProperties) : undefined}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
