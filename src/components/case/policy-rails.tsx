import { CircleCheck, CircleX, ShieldCheck } from "lucide-react";
import type { PolicyCheck } from "@/types/domain";

function humanizeRule(name: string): string {
  return name
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/**
 * The deterministic guardrails, shown as a rail of gates the decision had
 * to pass through. Every rule is always evaluated and always displayed —
 * showing only the failures would hide the fact that the other six were
 * checked, which is the part that makes the system trustworthy.
 */
export function PolicyRails({ checks }: { checks: PolicyCheck[] }) {
  if (checks.length === 0) {
    return (
      <div className="glass p-10 text-center text-sm text-muted-foreground">
        Policy hasn&apos;t been evaluated for this case yet.
      </div>
    );
  }

  const failed = checks.filter((c) => !c.passed);

  return (
    <div className="space-y-3">
      <div className="inset-panel flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5">
        <ShieldCheck className={`size-4 shrink-0 ${failed.length === 0 ? "text-emerald-400" : "text-amber-400"}`} />
        <span className="text-[13px] font-medium">
          {checks.length} guardrail{checks.length === 1 ? "" : "s"} evaluated
        </span>
        <span className={`text-xs ${failed.length === 0 ? "text-emerald-300/80" : "text-amber-300"}`}>
          {failed.length === 0 ? "all passed" : `${failed.length} triggered an override`}
        </span>
      </div>

      <div className="space-y-1.5">
        {checks.map((check, i) => (
          <div
            key={check.id}
            className={`rise flex items-start gap-3 rounded-lg border-l-2 py-2.5 pr-3 pl-3 transition-colors ${
              check.passed
                ? "border-l-emerald-500/30 bg-white/[0.015] hover:bg-white/[0.03]"
                : "border-l-amber-400/60 bg-amber-500/[0.05]"
            }`}
            style={{ "--d": `${i * 40}ms` } as React.CSSProperties}
          >
            {check.passed ? (
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-400/70" />
            ) : (
              <CircleX className="mt-0.5 size-4 shrink-0 text-amber-400" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-foreground/90">{humanizeRule(check.rule_name)}</div>
              <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{check.detail}</div>
            </div>
            <span
              className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold tracking-wider ${
                check.passed
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              }`}
            >
              {check.passed ? "PASS" : "FAIL"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
