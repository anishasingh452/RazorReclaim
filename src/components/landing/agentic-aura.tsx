import { SIGNAL_COLOR } from "@/lib/display";

/**
 * The hero's centrepiece: an iridescent form with three agents orbiting a
 * bright core.
 *
 * Built in CSS rather than shipped as an image so it stays crisp at any
 * size, animates, weighs nothing, and can use the product's own palette —
 * the three orbiting nodes are the three reasoners the product actually
 * runs (AI blue, value-engine emerald, policy amber), which is why there
 * are three and not a decorative handful.
 *
 * Deliberately sits behind a scrim in the hero: this is atmosphere, and the
 * headline has to stay the brightest thing on the page.
 */
export function AgenticAura() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      <div className="grain relative aspect-square w-[min(120vw,60rem)] opacity-[0.85]">
        {/* Iridescent layers. Each is a soft radial wash on its own morph
            cycle, offset in time so the silhouette never repeats cleanly. */}
        <div
          className="aura-blob inset-[8%]"
          style={{
            background: "radial-gradient(circle at 35% 40%, oklch(0.82 0.17 165 / 0.75), transparent 62%)",
            animationDelay: "-4s",
          }}
        />
        <div
          className="aura-blob inset-[14%]"
          style={{
            background: "radial-gradient(circle at 68% 58%, oklch(0.72 0.16 250 / 0.6), transparent 60%)",
            animationDelay: "-19s",
            animationDirection: "reverse",
          }}
        />
        <div
          className="aura-blob inset-[22%]"
          style={{
            background: "radial-gradient(circle at 52% 30%, oklch(0.7 0.17 300 / 0.5), transparent 58%)",
            animationDelay: "-31s",
          }}
        />
        <div
          className="aura-blob inset-[30%]"
          style={{
            background: "radial-gradient(circle at 44% 70%, oklch(0.85 0.15 90 / 0.32), transparent 55%)",
            animationDelay: "-11s",
            animationDirection: "reverse",
          }}
        />

        {/* The core the agents circle. */}
        <div
          className="absolute top-1/2 left-1/2 size-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: "radial-gradient(circle, oklch(0.98 0.02 165 / 0.5), oklch(0.82 0.17 165 / 0.18) 45%, transparent 70%)",
            filter: "blur(18px)",
          }}
        />

        {/* Orbits, in a shared perspective so the planes read as tilted
            rings in space rather than flat ellipses. */}
        <div className="absolute inset-0" style={{ perspective: "1100px" }}>
          <Orbit size="76%" tilt="74deg" duration="34s" color={SIGNAL_COLOR.ai} />
          <Orbit size="58%" tilt="62deg" duration="24s" color={SIGNAL_COLOR.engine} reverse />
          <Orbit size="92%" tilt="81deg" duration="46s" color={SIGNAL_COLOR.policy} />
        </div>
      </div>
    </div>
  );
}

function Orbit({
  size,
  tilt,
  duration,
  color,
  reverse,
}: {
  size: string;
  tilt: string;
  duration: string;
  color: string;
  reverse?: boolean;
}) {
  return (
    <div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ width: size, height: size }}
    >
      <div
        className="orbit-plane"
        style={
          {
            "--tilt": tilt,
            "--dur": duration,
            animationDirection: reverse ? "reverse" : undefined,
          } as React.CSSProperties
        }
      >
        <span className="orbit-node" style={{ background: color, boxShadow: `0 0 14px 2px ${color}` }} />
      </div>
    </div>
  );
}
