// Jobs and the right to say no. A villager with a job works its hours and lives its own life outside them, but
// a shift is a choice, not a script: it can skip one for a reason of its own, and refuse a deal with someone
// it has a reason not to deal with. Every answer carries that reason. Pure: no model or world state here.

import type { Phase } from "../life/clock";
import type { Needs } from "../life/needs";
import { GRUDGE_TRUST, hurt, toYou, type Bond } from "./bonds";
import type { Persona } from "./persona";

export const JOB_PULL = 2.5; // beats needs and hobbies, loses to a promise (PROMISE_PULL)

export interface Duty {
  work: boolean;
  why: string; // empty off hours: nothing to explain
}

// Stable across machines: the same villager skips the same day on every screen.
const roll = (id: string, day: number): number => [...id].reduce((s, c) => s + c.charCodeAt(0), day * 7);
const has = (p: Persona, ...ts: string[]): boolean => p.traits.some((t) => ts.includes(t.toLowerCase()));

// `saving` = the goal it is close to, if any: that beats a day off, not its body or its word.
export function shiftChoice(p: Persona, needs: Needs, phase: Phase, day: number, promised: string, saving = ""): Duty {
  const job = p.job;
  if (!job || !job.phases.includes(phase)) return { work: false, why: "" };
  const shift = `${job.title} shift`;
  if (promised) return { work: false, why: `${shift} > promised ${promised} > skip work` };
  if (needs.energy < 20) return { work: false, why: `${shift} > too tired > rest first` };
  if (needs.hunger < 15) return { work: false, why: `${shift} > too hungry > eat first` };
  if (saving) return { work: true, why: `${shift} > saving for ${saving} > go to work` };
  if (has(p, "playful") && roll(p.id, day) % 3 === 0) return { work: false, why: `${shift} > feel like playing > skip work today` };
  if (has(p, "curious") && !has(p, "patient") && roll(p.id, day) % 5 === 0) return { work: false, why: `${shift} > want to wander > skip work today` };
  return { work: true, why: `${shift} > feel fine > go to work` };
}

// How far someone can fall before this villager stops dealing with them.
export const dealLimit = (p: Persona): number => has(p, "gentle", "patient") ? -30 : has(p, "grumpy", "loud") ? -5 : -15;

export const refusesDeal = (p: Persona, b: Bond | undefined): boolean => !!b && (b.fondness <= dealLimit(p) || b.trust <= GRUDGE_TRUST);

// Past even that, the villager will not talk at all, unless it is to say sorry or to ask why.
export const refusesChat = (p: Persona, b: Bond | undefined): boolean => !!b && b.fondness <= dealLimit(p) - 15;

export function refuseLine(b: Bond | undefined, who: string): string {
  const r = b && hurt(b);
  return `Not today, ${who}.${r ? ` Last time, ${toYou(r.text, who)}.` : ""}`;
}
