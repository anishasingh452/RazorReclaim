import { Ban } from "lucide-react";
import { ACTION_COLOR, ACTION_FILL, ACTION_LABEL, formatInrPrecise } from "@/lib/display";
import type { ImpactScore } from "@/types/domain";

/**
 * The Business Impact Engine's full working, as a ledger you can read at a
 * glance: every action it considered, priced side by side, with the winner
 * lit up and the ruled-out options kept visible (greyed, with the reason)
 * rather than hidden — "what we didn't do, and why" is half the point.
 */
export function ErvBars({ scores }: { scores: ImpactScore[] }) {
  const feasible = scores.filter((s) => s.feasible);
  const infeasible = scores.filter((s) => !s.feasible);
  const maxErv = Math.max(...feasible.map((s) => Math.abs(s.expected_recovery_value)), 1);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        {feasible.map((score, i) => {
          const width = Math.max((Math.abs(score.expected_recovery_value) / maxErv) * 100, 1.5);
          const negative = score.expected_recovery_value < 0;
          const fill = negative ? "oklch(0.62 0.115 22)" : ACTION_FILL[score.action_type];

          return (
            <div
              key={score.id}
              className={`rise group relative grid grid-cols-[minmax(7rem,9rem)_1fr_auto] items-center gap-3 rounded-lg px-2.5 py-2 transition-colors ${
                score.selected ? "bg-emerald-500/[0.07] ring-1 ring-emerald-500/25" : "hover:bg-white/[0.03]"
              }`}
              style={{ "--d": `${i * 45}ms` } as React.CSSProperties}
            >
              <span
                className={`inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${ACTION_COLOR[score.action_type]}`}
              >
                {ACTION_LABEL[score.action_type]}
              </span>

              <div className="relative h-6 overflow-hidden rounded-md bg-white/[0.03]">
                <div
                  className="h-full rounded-md transition-[width] duration-700 ease-out"
                  style={{
                    width: `${width}%`,
                    background: `linear-gradient(90deg, ${fill}22, ${fill}bb)`,
                    
                  }}
                />
                <span className="absolute inset-y-0 left-2 flex items-center gap-2 text-[10px] text-white/45">
                  <span className="stat-value">{(score.recovery_probability * 100).toFixed(0)}% likely</span>
                  <span className="text-white/20">·</span>
                  <span className="stat-value">cost {formatInrPrecise(score.intervention_cost)}</span>
                </span>
              </div>

              <div className="flex items-center gap-2 text-right">
                <span
                  className={`stat-value text-sm font-semibold ${
                    negative ? "text-rose-300" : score.selected ? "text-emerald-300" : "text-foreground/80"
                  }`}
                >
                  {formatInrPrecise(score.expected_recovery_value)}
                </span>
                {score.selected && (
                  <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-emerald-300">
                    CHOSEN
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {infeasible.length > 0 && (
        <div className="space-y-1.5 border-t border-white/[0.06] pt-3">
          <div className="micro-label mb-2 flex items-center gap-1.5">
            <Ban className="size-3" />
            Ruled out before scoring
          </div>
          {infeasible.map((score) => (
            <div key={score.id} className="flex items-start gap-3 px-2.5 py-1">
              <span className="inline-flex w-fit shrink-0 items-center rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-0.5 text-[11px] font-medium text-zinc-500 line-through">
                {ACTION_LABEL[score.action_type]}
              </span>
              <span className="text-xs leading-relaxed text-muted-foreground/70">{score.exclusion_reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
