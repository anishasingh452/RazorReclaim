// Deterministic PRNG + distribution helpers so a batch is fully reproducible
// from its seed (mulberry32 — small, fast, good-enough statistical quality
// for synthetic demo data; not for anything security-sensitive).

export type Rng = () => number;

export function createRng(seed: string): Rng {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = h >>> 0;
  return function mulberry32() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function uniform(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function uniformInt(rng: Rng, min: number, max: number): number {
  return Math.floor(uniform(rng, min, max + 1));
}

export function choice<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

export function weightedChoice<T>(rng: Rng, items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [item, w] of items) {
    r -= w;
    if (r <= 0) return item;
  }
  return items[items.length - 1][0];
}

export function bool(rng: Rng, pTrue = 0.5): boolean {
  return rng() < pTrue;
}

/** Log-normal-ish draw bounded to [min, max] — realistic skew for monetary amounts. */
export function logNormalRange(rng: Rng, min: number, max: number): number {
  const u1 = Math.max(rng(), 1e-9);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); // standard normal
  const t = clamp01((z + 3) / 6); // fold ~[-3,3] into [0,1]
  return min + t * (max - min);
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
