import { Link2, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  AUDIT_ACTOR_COLOR,
  AUDIT_ACTOR_DOT,
  AUDIT_ACTOR_LABEL,
  auditEventLabel,
} from "@/lib/display";
import type { AuditChainIntegrity, AuditEvent } from "@/types/domain";

/** Renders one audit `detail` value as a compact chip value, never raw JSON soup. */
function formatValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === "string") return value.length > 90 ? `${value.slice(0, 90)}…` : value.replace(/_/g, " ");
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  return null; // nested objects are noise at this altitude
}

/**
 * The case's full decision graph: every event, in order, attributed to the
 * engine or human that produced it, with the SHA-256 chain that makes the
 * record tamper-evident drawn as an actual chain — each node's hash links
 * back to the previous one, and the whole thing is re-verified on read
 * rather than trusted.
 */
export function DecisionGraph({
  events,
  integrity,
}: {
  events: AuditEvent[];
  integrity: AuditChainIntegrity;
}) {
  if (events.length === 0) {
    return (
      <div className="glass p-10 text-center text-sm text-muted-foreground">
        No decision events recorded yet — run this batch to populate the graph.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <IntegrityBanner integrity={integrity} />

      <ol className="relative space-y-1">
        {/* The spine the whole chain hangs from. */}
        <span
          aria-hidden
          className="absolute top-2 bottom-2 left-[7px] w-px bg-gradient-to-b from-emerald-400/25 via-white/10 to-transparent"
        />

        {events.map((event, i) => {
          const broken = integrity.brokenAtIndex !== null && i >= integrity.brokenAtIndex;
          const chips = Object.entries(event.detail ?? {})
            .map(([key, value]) => [key, formatValue(value)] as const)
            .filter((entry): entry is readonly [string, string] => entry[1] !== null)
            .slice(0, 5);

          return (
            <li
              key={event.id}
              className="rise group relative grid grid-cols-[auto_1fr] gap-3 rounded-lg py-2 pr-2 pl-0 transition-colors hover:bg-white/[0.02]"
              style={{ "--d": `${Math.min(i * 28, 500)}ms` } as React.CSSProperties}
            >
              <span className="relative z-10 mt-1.5 flex size-[15px] items-center justify-center">
                <span
                  className={`size-2 rounded-full ring-4 ring-background ${
                    broken ? "bg-red-400" : AUDIT_ACTOR_DOT[event.actor]
                  }`}
                />
              </span>

              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[13px] font-medium text-foreground/90">
                    {auditEventLabel(event.event_type)}
                  </span>
                  <span
                    className={`inline-flex items-center rounded border px-1.5 py-0 text-[10px] font-medium ${AUDIT_ACTOR_COLOR[event.actor]}`}
                  >
                    {AUDIT_ACTOR_LABEL[event.actor]}
                  </span>
                  <span className="stat-value text-[10px] text-muted-foreground/60">
                    {new Date(event.created_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  {event.model_version && (
                    <span className="stat-value text-[10px] text-muted-foreground/40">{event.model_version}</span>
                  )}
                </div>

                {chips.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {chips.map(([key, value]) => (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1 rounded border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 text-[10.5px]"
                      >
                        <span className="text-muted-foreground/60">{key.replace(/_/g, " ")}</span>
                        <span className="stat-value text-foreground/75">{value}</span>
                      </span>
                    ))}
                  </div>
                )}

                {event.hash && (
                  <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Link2 className="size-3 text-muted-foreground/40" />
                    <span className="stat-value text-[10px] text-muted-foreground/40">
                      {event.prev_hash === "GENESIS" ? "GENESIS" : event.prev_hash?.slice(0, 8)}
                      <span className="mx-1 text-muted-foreground/25">→</span>
                      {event.hash.slice(0, 8)}
                    </span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function IntegrityBanner({ integrity }: { integrity: AuditChainIntegrity }) {
  const { intact, brokenAtIndex, chainedRows, unchainedRows } = integrity;

  return (
    <div
      className={`inset-panel flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5 ${
        intact ? "" : "border-red-500/25 bg-red-500/[0.06]"
      }`}
    >
      {intact ? (
        <ShieldCheck className="size-4 shrink-0 text-emerald-400" />
      ) : (
        <ShieldAlert className="size-4 shrink-0 text-red-400" />
      )}
      <span className={`text-[13px] font-medium ${intact ? "text-emerald-300" : "text-red-300"}`}>
        {intact ? "Hash chain verified" : `Chain integrity broken at event #${(brokenAtIndex ?? 0) + 1}`}
      </span>
      <span className="text-xs text-muted-foreground">
        {chainedRows} cryptographically linked event{chainedRows === 1 ? "" : "s"}
        {unchainedRows > 0 && ` · ${unchainedRows} pre-chain event${unchainedRows === 1 ? "" : "s"} excluded`}
      </span>
      <span className="ml-auto hidden text-[10.5px] text-muted-foreground/50 sm:block">
        Re-computed from row contents on every read
      </span>
    </div>
  );
}
