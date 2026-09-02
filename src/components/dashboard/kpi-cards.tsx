import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInr } from "@/lib/display";
import type { BatchDetail } from "@/lib/api-client";

export function KpiCards({ detail }: { detail: BatchDetail | null }) {
  const b = detail?.batch;
  const atRisk = b?.total_at_risk ?? 0;
  const recovered = b?.total_recovered ?? 0;
  const erv = b?.total_expected_recovery_value ?? 0;
  const recoveryRate = atRisk > 0 ? (recovered / atRisk) * 100 : 0;
  const totalCases = detail?.totalCases ?? 0;
  const processed = totalCases - (detail?.statusBreakdown.open ?? 0);
  const decisionsExecuted = Object.entries(detail?.actionBreakdown ?? {}).reduce((s, [, n]) => s + n, 0);

  const cards = [
    { label: "Total Revenue At Risk", value: formatInr(atRisk) },
    { label: "Revenue Recovered", value: formatInr(recovered), accent: "text-emerald-600" },
    { label: "Recovery Rate", value: `${recoveryRate.toFixed(1)}%` },
    { label: "Expected Recovery Value", value: formatInr(erv), sub: "sum of ERV-selected actions" },
    { label: "Cases Processed", value: `${processed} / ${totalCases}` },
    { label: "AI Decisions Executed", value: String(decisionsExecuted) },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => (
        <Card key={c.label} className="gap-1 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-xs font-medium text-neutral-500">{c.label}</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <div className={`text-xl font-semibold tabular-nums ${c.accent ?? ""}`}>{c.value}</div>
            {c.sub && <div className="text-[11px] text-neutral-400 mt-0.5">{c.sub}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
