import { PIPELINE_STAGES, type PipelineStageKey } from "@/lib/pipeline";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type StageStatus = "done" | "active" | "pending" | "skipped";

const DOT_CLASS: Record<StageStatus, string> = {
  done: "bg-emerald-400 ring-4 ring-emerald-400/15",
  active: "bg-blue-400 ring-4 ring-blue-400/20 animate-pulse",
  pending: "bg-white/15",
  skipped: "bg-white/10",
};

const LABEL_CLASS: Record<StageStatus, string> = {
  done: "text-foreground",
  active: "text-blue-300",
  pending: "text-muted-foreground",
  skipped: "text-muted-foreground/50",
};

const LINE_CLASS: Record<StageStatus, string> = {
  done: "bg-emerald-400/40",
  active: "bg-gradient-to-r from-emerald-400/40 to-white/10",
  pending: "bg-white/10",
  skipped: "bg-white/10",
};

export function PipelineStepper({
  statuses,
  counts,
}: {
  statuses: Partial<Record<PipelineStageKey, StageStatus>>;
  counts?: Partial<Record<PipelineStageKey, number>>;
}) {
  return (
    <div className="flex items-center w-full overflow-x-auto py-1">
      {PIPELINE_STAGES.map((stage, i) => {
        const status = statuses[stage.key] ?? "pending";
        const count = counts?.[stage.key];
        return (
          <div key={stage.key} className="flex items-center shrink-0 last:flex-1">
            <Tooltip>
              <TooltipTrigger className="flex flex-col items-center gap-1.5 px-1">
                <span className={`size-2.5 rounded-full transition-colors ${DOT_CLASS[status]}`} />
                <span className={`text-[11px] font-medium whitespace-nowrap ${LABEL_CLASS[status]}`}>
                  {stage.label}
                  {typeof count === "number" && count > 0 && (
                    <span className="ml-1 font-mono text-[10px] text-muted-foreground">{count}</span>
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent>{stage.hint}</TooltipContent>
            </Tooltip>
            {i < PIPELINE_STAGES.length - 1 && (
              <span className={`h-px w-8 md:w-12 mx-1 -mt-4 shrink-0 ${LINE_CLASS[status]}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
