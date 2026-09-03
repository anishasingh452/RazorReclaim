import { PIPELINE_STAGES } from "@/lib/pipeline";

/**
 * The eight-stage recovery pipeline as a looping pulse of activity. Same
 * vocabulary the live Command Center uses, so the landing promises exactly
 * what the product then shows.
 */
export function PipelineLoop() {
  return (
    <div className="flex w-full items-start overflow-x-auto pb-2">
      {PIPELINE_STAGES.map((stage, i) => {
        const delay = `${i * 0.34}s`;
        const isLast = i === PIPELINE_STAGES.length - 1;

        return (
          <div key={stage.key} className="flex min-w-0 flex-1 items-start last:flex-none">
            <div className="flex w-20 shrink-0 flex-col items-center gap-3 sm:w-auto sm:min-w-[7rem]">
              <span className="flex h-3 items-center">
                <span
                  className="pulse-node size-2 rounded-full bg-emerald-400"
                  style={{ animationDelay: delay }}
                />
              </span>
              <span className="text-center text-[11px] leading-tight font-medium text-white/70 sm:text-xs">
                {stage.label}
              </span>
              <span className="hidden max-w-[9rem] text-center text-[10.5px] leading-snug text-white/35 lg:block">
                {stage.hint}
              </span>
            </div>

            {!isLast && (
              <span
                className="pulse-link mt-[5px] h-px min-w-5 flex-1 bg-gradient-to-r from-emerald-400/70 to-emerald-400/30"
                style={{ animationDelay: delay }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
