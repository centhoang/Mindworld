// Needs drive every mind's day (GARP-lite): each need falls over game time and activities refill it.
// 100 = fully satisfied, 0 = desperate. Pure data + arithmetic.

export const NEEDS = ["hunger", "energy", "fun", "social", "hygiene", "bladder"] as const;
export type Need = (typeof NEEDS)[number];
export type Needs = Record<Need, number>;
export type Kind = "pet" | "human";

// Points lost per game hour. Humans don't track bladder (they never poop on the lawn).
const DECAY: Record<Kind, Needs> = {
  pet: { hunger: 6, energy: 4, fun: 7, social: 5, hygiene: 3, bladder: 8 },
  human: { hunger: 5, energy: 4, fun: 5, social: 4, hygiene: 3, bladder: 0 },
};

export function fullNeeds(): Needs {
  return { hunger: 80, energy: 90, fun: 70, social: 60, hygiene: 85, bladder: 90 };
}

export const clampNeed = (v: number): number => Math.max(0, Math.min(100, v));

export function decay(n: Needs, kind: Kind, hours: number): Needs {
  const out = { ...n };
  for (const k of NEEDS) out[k] = clampNeed(n[k] - DECAY[kind][k] * hours);
  return out;
}

// Effects are given per full activity; `frac` applies part of it (activities pay out as they run).
export function applyEffects(n: Needs, fx: Partial<Needs>, frac = 1): Needs {
  const out = { ...n };
  for (const k of NEEDS) if (fx[k]) out[k] = clampNeed(n[k] + fx[k]! * frac);
  return out;
}

// How badly a need wants attention, 0..1, steep below 30 (a hungry pet ignores the ball).
export function urgency(v: number): number {
  const x = 1 - clampNeed(v) / 100;
  return v < 30 ? Math.min(1, x * 1.4) : x * x;
}

// Needs sorted from most to least urgent (kind-aware: humans skip bladder).
export function mostUrgent(n: Needs, kind: Kind): Need[] {
  return NEEDS.filter((k) => DECAY[kind][k] > 0).sort((a, b) => urgency(n[b]) - urgency(n[a]));
}
