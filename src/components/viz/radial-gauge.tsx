import { SIGNAL_COLOR } from "@/lib/display";

interface RadialGaugeProps {
  /** 0..1 */
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  /** Overrides the automatic confidence banding. */
  color?: string;
}

function bandColor(value: number): string {
  if (value >= 0.7) return SIGNAL_COLOR.engine;
  if (value >= 0.4) return SIGNAL_COLOR.policy;
  return SIGNAL_COLOR.stop;
}

/**
 * A probability/confidence dial. Drawn as a 270° arc (open at the bottom)
 * so it reads as a gauge rather than a pie — the empty track stays visible,
 * which matters when the point is "how confident, out of how much."
 */
export function RadialGauge({ value, size = 88, strokeWidth = 6, label, color }: RadialGaugeProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const stroke = color ?? bandColor(clamped);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 0.75; // 270° of the circle
  const trackLength = circumference * arcFraction;

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-[225deg]" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="oklch(1 0 0 / 0.07)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${trackLength} ${circumference}`}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${trackLength * clamped} ${circumference}`}
          style={{ filter: `drop-shadow(0 0 6px ${stroke})`, transition: "stroke-dasharray 700ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      {/* Nudged up so the readout sits in the optical center of a 270° arc
          rather than colliding with the open gap at the bottom. */}
      <div className="absolute inset-x-0 top-0 flex flex-col items-center justify-center" style={{ height: size * 0.82 }}>
        <span className="stat-value font-semibold" style={{ color: stroke, fontSize: size * 0.22 }}>
          {Math.round(clamped * 100)}%
        </span>
        {label && (
          <span className="micro-label mt-0.5" style={{ fontSize: Math.max(size * 0.09, 7) }}>
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
