import { CircleSlash } from "lucide-react";
import {
  ACTION_COLOR,
  ACTION_LABEL,
  NO_ACTION_REASON_LABEL,
  formatInrPrecise,
} from "@/lib/display";
import type { ActionType, NoActionDecision } from "@/types/domain";

interface Alternative {
  action: ActionType;
  erv: number;
}

/** `alternatives_considered` is jsonb — validate rather than trust its shape. */
function parseAlternatives(raw: Record<string, unknown>[]): Alternative[] {
  return raw.flatMap((entry) => {
    const action = entry.action;
    const erv = entry.erv;
    if (typeof action !== "string" || typeof erv !== "number") return [];
    if (!(action in ACTION_LABEL)) return [];
    return [{ action: action as ActionType, erv }];
  });
}

/**
 * The signature feature: a decision NOT to engage, argued rather than
 * merely recorded. Most recovery tools can only explain what they did;
 * this panel explains what the system deliberately declined to do, names
 * the specific reason, and shows the alternatives it priced before deciding
 * silence was worth more than contact.
 */
export function WhyNotToAct({
  decision,
  finalAction,
}: {
  decision: NoActionDecision;
  finalAction: ActionType | null;
}) {
  const alternatives = parseAlternatives(decision.alternatives_considered ?? []);

  return (
    <section className="rise glass relative overflow-hidden border-amber-500/20 p-5">
      {/* Warm ambient wash behind the emblem — this is a considered
          judgment, not an error state, so it reads amber-gold rather than red. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-16 size-64 rounded-full bg-amber-400/[0.035] blur-3xl"
      />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
        <Emblem />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="micro-label text-amber-300/80">Why not to act</span>
            {finalAction && (
              <span
                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${ACTION_COLOR[finalAction]}`}
              >
                {ACTION_LABEL[finalAction]}
              </span>
            )}
          </div>

          <h3 className="text-luminous text-lg font-semibold tracking-tight">
            {NO_ACTION_REASON_LABEL[decision.reason_code]}
          </h3>

          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{decision.explanation}</p>

          {alternatives.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="micro-label">Alternatives priced before deciding</div>
              <div className="flex flex-wrap gap-1.5">
                {alternatives.map((alt) => (
                  <span
                    key={alt.action}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] py-1 pr-2 pl-1.5 text-[11px]"
                  >
                    <span
                      className={`inline-flex items-center rounded border px-1.5 py-0 text-[10px] font-medium ${ACTION_COLOR[alt.action]}`}
                    >
                      {ACTION_LABEL[alt.action]}
                    </span>
                    <span className={`stat-value ${alt.erv > 0 ? "text-foreground/70" : "text-rose-300/80"}`}>
                      {formatInrPrecise(alt.erv)}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** A slowly rotating dashed ring around a struck-through circle — restraint, visualized. */
function Emblem() {
  return (
    <div className="relative flex size-20 shrink-0 items-center justify-center">
      <svg viewBox="0 0 80 80" className="absolute inset-0 size-full" aria-hidden>
        <circle
          cx="40"
          cy="40"
          r="37"
          fill="none"
          stroke="oklch(0.76 0.1 78 / 0.22)"
          strokeWidth="1"
          strokeDasharray="3 7"
          className="animate-spin [animation-duration:18s]"
          style={{ transformOrigin: "40px 40px" }}
        />
        <circle cx="40" cy="40" r="28" fill="oklch(0.76 0.1 78 / 0.05)" stroke="oklch(0.76 0.1 78 / 0.18)" />
      </svg>
      <CircleSlash className="relative size-7 text-amber-300/80" strokeWidth={1.5} />
    </div>
  );
}
