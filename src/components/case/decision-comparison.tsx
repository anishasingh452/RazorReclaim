import { Sparkles, Calculator, ShieldCheck, ArrowRight } from "lucide-react";
import { ACTION_COLOR, ACTION_LABEL, confidenceColor, formatInrPrecise } from "@/lib/display";
import type { ActionType } from "@/types/domain";

interface DecisionComparisonProps {
  aiAction: ActionType | null;
  aiConfidence: number | null;
  engineAction: ActionType | null;
  engineErv: number | null;
  engineProbability: number | null;
  finalAction: ActionType | null;
  policyAllowed: boolean | null;
  failedRules: string[];
}

/**
 * The flagship transparency artifact: three independent "voices" in the
 * decision, shown side by side so a divergence between what the AI
 * suggested, what the deterministic Business Impact Engine calculated as
 * highest-ERV, and what the Policy Engine actually allowed is immediately
 * visible — not buried in a table.
 */
export function DecisionComparison(props: DecisionComparisonProps) {
  const aiVsEngineDiverge =
    props.aiAction && props.engineAction && props.aiAction !== props.engineAction;
  const engineVsPolicyDiverge =
    props.engineAction && props.finalAction && props.engineAction !== props.finalAction;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-3 items-stretch">
      <DecisionCard
        icon={<Sparkles className="size-4" />}
        eyebrow="AI Recommendation"
        accent="text-blue-300"
        action={props.aiAction}
        detail={
          props.aiConfidence !== null && (
            <span className={`font-mono text-xs ${confidenceColor(props.aiConfidence)}`}>
              {(props.aiConfidence * 100).toFixed(0)}% confidence
            </span>
          )
        }
      />

      <Connector diverges={aiVsEngineDiverge} label={aiVsEngineDiverge ? "overridden" : "agrees"} />

      <DecisionCard
        icon={<Calculator className="size-4" />}
        eyebrow="Business Engine Decision"
        accent="text-emerald-300"
        action={props.engineAction}
        detail={
          props.engineErv !== null && (
            <span className="font-mono text-xs text-emerald-300">
              ERV {formatInrPrecise(props.engineErv)}
              {props.engineProbability !== null && (
                <span className="text-muted-foreground"> · {(props.engineProbability * 100).toFixed(0)}%</span>
              )}
            </span>
          )
        }
      />

      <Connector diverges={engineVsPolicyDiverge} label={engineVsPolicyDiverge ? "blocked" : "approved"} />

      <DecisionCard
        icon={<ShieldCheck className="size-4" />}
        eyebrow="Policy Outcome"
        accent={props.policyAllowed ? "text-emerald-300" : "text-amber-300"}
        action={props.finalAction}
        detail={
          props.failedRules.length > 0 ? (
            <span className="font-mono text-[10px] text-amber-300 leading-tight block">
              {props.failedRules.join(", ")}
            </span>
          ) : (
            <span className="font-mono text-xs text-muted-foreground">all rules passed</span>
          )
        }
      />
    </div>
  );
}

function DecisionCard({
  icon,
  eyebrow,
  accent,
  action,
  detail,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  accent: string;
  action: ActionType | null;
  detail: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-2 min-w-0">
      <div className={`flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide ${accent}`}>
        {icon}
        {eyebrow}
      </div>
      {action ? (
        <span
          className={`inline-flex w-fit items-center rounded-md border px-2 py-1 text-sm font-semibold ${ACTION_COLOR[action]}`}
        >
          {ACTION_LABEL[action]}
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      )}
      <div>{detail}</div>
    </div>
  );
}

function Connector({ diverges, label }: { diverges: boolean | null; label: string }) {
  return (
    <div className="flex md:flex-col items-center justify-center gap-1 py-1 md:py-0">
      <ArrowRight
        className={`size-4 rotate-90 md:rotate-0 ${diverges ? "text-amber-400" : "text-white/15"}`}
      />
      <span
        className={`text-[10px] font-mono uppercase tracking-wide whitespace-nowrap ${
          diverges ? "text-amber-400" : "text-muted-foreground/60"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
