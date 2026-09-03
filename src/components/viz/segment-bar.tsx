export interface Segment {
  key: string;
  label: string;
  value: number;
  /** Raw color for the segment fill (SIGNAL_COLOR or any oklch/hex string). */
  color: string;
}

/**
 * A single stacked bar for portfolio composition (case status, decision
 * mix). Preferred over a donut here: proportions of a whole read faster in
 * one dimension, and the legend can carry exact counts without callouts.
 */
export function SegmentBar({ segments, total }: { segments: Segment[]; total: number }) {
  const present = segments.filter((s) => s.value > 0);
  const sum = total > 0 ? total : present.reduce((acc, s) => acc + s.value, 0);

  if (sum === 0) {
    return <div className="h-2 w-full rounded-full bg-white/[0.05]" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-white/[0.04]">
        {present.map((s) => (
          <div
            key={s.key}
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{
              width: `${(s.value / sum) * 100}%`,
              background: s.color,
              boxShadow: `0 0 12px -2px ${s.color}`,
            }}
            title={`${s.label}: ${s.value}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {present.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="size-1.5 rounded-full" style={{ background: s.color }} />
            {s.label}
            <span className="stat-value text-foreground/80">{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
