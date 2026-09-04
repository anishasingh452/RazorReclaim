import { ArrowRight, Calculator, ShieldCheck, Sparkles } from "lucide-react";
import {
  ACTION_COLOR,
  ACTION_LABEL,
  DECISION_CATEGORY_COLOR,
  DECISION_CATEGORY_LABEL,
  actionToCategory,
  confidenceColor,
  formatInrPrecise,
} from "@/lib/display";
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
 * The flagship transparency artifact: three independent voices in one
 * decision, shown as a chain so divergence is impossible to miss. When the
 * AI's pick, the deterministic ERV winner, and what policy actually allowed
 * disagree, the connectors between them light amber and say so — the
 * disagreement is the story, not a footnote in a table.
 */
export function DecisionComparison(props: DecisionComparisonProps) {
  const aiVsEngineDiverge = !!props.aiAction && !!props.engineAction && props.aiAction !== props.engineAction;
  const engineVsPolicyDiverge = !!props.engineAction && !!props.finalAction && props.engineAction !== props.finalAction;
  const category = props.finalAction ? actionToCategory(props.finalAction) : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <DecisionCard
          icon={<Sparkles className="size-3.5" />}
          eyebrow="AI Recommendation"
          tone="ai"
          action={props.aiAction}
          delay={0}
          detail={
            props.aiConfidence !== null && (
              <span className={`stat-value text-xs ${confidenceColor(props.aiConfidence)}`}>
                {(props.aiConfidence * 100).toFixed(0)}% confidence
              </span>
            )
          }
        />

        <Connector diverges={aiVsEngineDiverge} label={aiVsEngineDiverge ? "overridden" : "agrees"} delay={90} />

        <DecisionCard
          icon={<Calculator className="size-3.5" />}
          eyebrow="Business Engine"
          tone="engine"
          action={props.engineAction}
          delay={140}
          detail={
            props.engineErv !== null && (
              <span className="stat-value text-xs text-emerald-300">
                ERV {formatInrPrecise(props.engineErv)}
                {props.engineProbability !== null && (
                  <span className="text-muted-foreground"> · {(props.engineProbability * 100).toFixed(0)}%</span>
                )}
              </span>
            )
          }
        />

        <Connector diverges={engineVsPolicyDiverge} label={engineVsPolicyDiverge ? "blocked" : "cleared"} delay={230} />

        <DecisionCard
          icon={<ShieldCheck className="size-3.5" />}
          eyebrow="Policy Outcome"
          tone={props.policyAllowed === false ? "policy" : "engine"}
          action={props.finalAction}
          delay={280}
          detail={
            props.failedRules.length > 0 ? (
              <span className="stat-value block text-[10px] leading-tight text-amber-300">
                {props.failedRules.join(", ")}
              </span>
            ) : (
              <span className="stat-value text-xs text-muted-foreground">all guardrails passed</span>
            )
          }
        />
      </div>

      {category && (
        <div className="flex items-center gap-2.5 border-t border-white/[0.06] pt-3">
          <span className="micro-label">Command Center verdict</span>
          <span className="hairline h-px flex-1" />
          <span
            className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold tracking-wide ${DECISION_CATEGORY_COLOR[category]}`}
          >
            {DECISION_CATEGORY_LABEL[category].toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
}

const TONE: Record<"ai" | "engine" | "policy", { text: string; ring: string; icon: string }> = {
  ai: {
    text: "text-sky-300",
    ring: "",
    icon: "bg-sky-500/[0.08] text-sky-200 border-sky-500/20",
  },
  engine: {
    text: "text-emerald-300",
    ring: "",
    icon: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
  },
  policy: {
    text: "text-amber-300",
    ring: "",
    icon: "bg-amber-500/[0.08] text-amber-200 border-amber-500/20",
  },
};

function DecisionCard({
  icon,
  eyebrow,
  tone,
  action,
  detail,
  delay,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  tone: "ai" | "engine" | "policy";
  action: ActionType | null;
  detail: React.ReactNode;
  delay: number;
}) {
  const t = TONE[tone];
  return (
    <div
      className={`rise glass glass-hover flex min-w-0 flex-col gap-2.5 p-4 ${t.ring}`}
      style={{ "--d": `${delay}ms` } as React.CSSProperties}
    >
      <div className="flex items-center gap-2">
        <span className={`flex size-6 items-center justify-center rounded-md border ${t.icon}`}>{icon}</span>
        <span className={`micro-label ${t.text}`}>{eyebrow}</span>
      </div>
      {action ? (
        <span
          className={`inline-flex w-fit items-center rounded-lg border px-2.5 py-1 text-sm font-semibold ${ACTION_COLOR[action]}`}
        >
          {ACTION_LABEL[action]}
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      )}
      <div className="min-h-4">{detail}</div>
    </div>
  );
}

function Connector({ diverges, label, delay }: { diverges: boolean; label: string; delay: number }) {
  return (
    <div
      className="fade-in flex items-center justify-center gap-1.5 py-1 md:flex-col md:py-0"
      style={{ "--d": `${delay}ms` } as React.CSSProperties}
    >
      <span
        className={`hidden h-6 w-px md:block ${diverges ? "bg-gradient-to-b from-transparent to-amber-400/40" : "bg-gradient-to-b from-transparent to-white/10"}`}
      />
      <ArrowRight className={`size-3.5 rotate-90 md:rotate-0 ${diverges ? "text-amber-400" : "text-white/20"}`} />
      <span
        className={`text-[9px] font-medium tracking-[0.14em] whitespace-nowrap uppercase ${
          diverges ? "text-amber-400" : "text-muted-foreground/50"
        }`}
      >
        {label}
      </span>
      <span
        className={`hidden h-6 w-px md:block ${diverges ? "bg-gradient-to-t from-transparent to-amber-400/40" : "bg-gradient-to-t from-transparent to-white/10"}`}
      />
    </div>
  );
}
