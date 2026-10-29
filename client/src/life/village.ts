// The living-world sim (GARP-lite): minds with needs walk to a spot, do an activity, and come back for
// the next choice. Group activities gather first (the starter waits for at least `min` members). Pure and
// deterministic given `env.rng`, so it is tested without a scene and runs the same on every machine.
// A mind's brain never runs inside an activity: it only picks the next one from `validChoices`.

import { slide, stepToward, WALK_SPEED, type Vec } from "../world/movement";
import { ACTIVITIES, ACTIVITY, type ActivityDef, type Place } from "./activities";
import { gameTime, HOUR_SECONDS, type Phase } from "./clock";
import { applyEffects, decay, fullNeeds, urgency, NEEDS, type Kind, type Needs } from "./needs";
import { bump, pairKey } from "./relations";

export type State = "idle" | "walk" | "wait" | "do";

export interface Agent {
  id: string;
  name: string;
  kind: Kind;
  pos: Vec;
  needs: Needs;
  state: State;
  act: string | null;
  target: Vec;
  left: number; // game minutes left in the current activity
  gather: number | null; // gathering id while in a group activity
  mess: number | null; // the mess being cleaned
  idle: number; // seconds before the next choice
  last: string | null; // previous activity (a small repeat penalty)
  plan: Partial<Record<Phase, string[]>>; // today's plan (from the mind; empty = needs only)
}

export interface Mess {
  id: number;
  pos: Vec;
  by: string;
}

export interface Gathering {
  id: number;
  act: string;
  at: Vec;
  members: string[];
  deadline: number; // sim seconds: cancel if still short of `min` arrived members
  started: boolean;
}

export interface Village {
  t: number; // sim seconds since the world started
  agents: Agent[];
  messes: Mess[];
  gatherings: Gathering[];
  rel: Map<string, number>; // pairKey -> affinity -100..100
  nextId: number;
}

export type Spots = Partial<Record<Place, Vec[]>>;

export interface Choice {
  act: string;
  score: number;
  join?: number; // gathering id
}

export interface Env {
  spots: Spots;
  canWalk: (x: number, z: number) => boolean;
  rng: () => number;
  // The mind's pick among the valid choices (sorted best first); null/unknown = take the best score,
  // undefined = still thinking (the agent waits a moment and asks again).
  chooser?: (a: Agent, choices: Choice[], v: Village) => string | null | undefined;
  bias?: (a: Agent, act: string) => number; // personality nudge on the scores
}

export type LifeEvent =
  | { kind: "start"; who: string; act: string; with: string[] }
  | { kind: "done"; who: string; act: string; with: string[] }
  | { kind: "mess"; who: string; id: number }
  | { kind: "cleaned"; who: string; id: number }
  | { kind: "cancel"; who: string; act: string };

const GATHER_WAIT = 25; // seconds the starter waits for company
const SPEED: Record<"pet" | "human", number> = { pet: WALK_SPEED * 0.3, human: WALK_SPEED * 0.4 };
const ARRIVE = 0.6;

export function newVillage(): Village {
  return { t: 0, agents: [], messes: [], gatherings: [], rel: new Map(), nextId: 1 };
}

export function addAgent(v: Village, id: string, name: string, kind: Kind, pos: Vec, needs = fullNeeds()): Agent {
  const a: Agent = { id, name, kind, pos: { ...pos }, needs, state: "idle", act: null, target: { ...pos }, left: 0, gather: null, mess: null, idle: 1 + v.agents.length * 0.7, last: null, plan: {} };
  v.agents.push(a);
  return a;
}

export function removeAgent(v: Village, id: string): void {
  v.agents = v.agents.filter((a) => a.id !== id);
  for (const g of v.gatherings) g.members = g.members.filter((m) => m !== id);
}

const pick = <T>(xs: readonly T[], rng: () => number): T => xs[Math.floor(rng() * xs.length) % xs.length]!;

// Everything this mind could start now, with a needs-based score. "wander" is always there.
export function validChoices(a: Agent, v: Village, env: Env): Choice[] {
  const phase = gameTime(v.t).phase;
  const out: Choice[] = [];
  for (const def of ACTIVITIES) {
    if (def.who !== "any" && def.who !== a.kind) continue;
    if (def.phases && !def.phases.includes(phase)) continue;
    if (def.place === "mess") {
      if (!v.messes.some((m) => !claimed(v, m.id))) continue;
    } else if (!env.spots[def.place]?.length) continue;
    const s = score(a, def, v, phase) + (env.bias?.(a, def.id) ?? 0);
    if (def.min > 1) {
      const open = v.gatherings.find((g) => g.act === def.id && g.members.length > 0 && g.members.length < def.max); // late joiners welcome
      if (open) {
        const aff = open.members.reduce((sum, m) => sum + (v.rel.get(pairKey(a.id, m)) ?? 0), 0) / Math.max(1, open.members.length);
        out.push({ act: def.id, score: s + 0.35 + aff / 200, join: open.id });
        continue;
      }
      if (!v.agents.some((o) => o !== a && (def.who === "any" || o.kind === def.who))) continue; // nobody could join
    }
    if (s > 0.05 || def.id === "wander") out.push({ act: def.id, score: s });
  }
  return out.sort((x, y) => y.score - x.score);
}

function claimed(v: Village, mess: number): boolean {
  return v.agents.some((o) => o.mess === mess);
}

function score(a: Agent, def: ActivityDef, v: Village, phase: Phase): number {
  let s = 0;
  for (const k of NEEDS) {
    const fx = def.fx[k] ?? 0;
    if (fx > 0) s += urgency(a.needs[k]) * Math.min(fx, 100 - a.needs[k]) / 50;
  }
  if (def.id === "poop") s = a.needs.bladder < 35 ? 1.2 : 0;
  if (def.id === "sleep") s += phase === "night" ? 1.5 : 0;
  if (def.id === "clean") s = 0.6 + v.messes.length * 0.15;
  if (def.id === "wander") s = 0.08;
  if (a.plan[phase]?.includes(def.id)) s += 0.3;
  if (a.last === def.id) s -= 0.15;
  return s;
}

// Starts the chosen activity: walk to its spot (or join a gathering).
function begin(a: Agent, c: Choice, v: Village, env: Env): void {
  const def = ACTIVITY.get(c.act)!;
  a.act = def.id;
  a.left = def.minutes;
  a.state = "walk";
  if (c.join !== undefined) {
    const g = v.gatherings.find((x) => x.id === c.join)!;
    g.members.push(a.id);
    a.gather = g.id;
    a.target = near(g.at, g.members.length, env.rng);
    return;
  }
  if (def.place === "mess") {
    const m = v.messes.find((x) => !claimed(v, x.id))!;
    a.mess = m.id;
    a.target = { ...m.pos };
    return;
  }
  const spot = def.place === "home" ? near(a.pos, 3, env.rng) : { ...pick(env.spots[def.place]!, env.rng) };
  a.target = spot;
  if (def.min > 1) {
    const g: Gathering = { id: v.nextId++, act: def.id, at: spot, members: [a.id], deadline: v.t + GATHER_WAIT, started: false };
    v.gatherings.push(g);
    a.gather = g.id;
  }
}

function near(p: Vec, spread: number, rng: () => number): Vec {
  const ang = rng() * Math.PI * 2;
  const d = 0.6 + rng() * spread * 0.5;
  return { x: p.x + Math.cos(ang) * d, z: p.z + Math.sin(ang) * d };
}

function stop(a: Agent): void {
  a.last = a.act;
  a.state = "idle";
  a.act = null;
  a.gather = null;
  a.mess = null;
  a.idle = 2;
}

export function choose(a: Agent, v: Village, env: Env): Choice | null {
  const cs = validChoices(a, v, env);
  const want = env.chooser?.(a, cs, v);
  if (want === undefined && env.chooser) return null; // thinking
  return cs.find((c) => c.act === want) ?? cs[0]!;
}

// Advance the world by dt real seconds.
export function stepVillage(v: Village, dt: number, env: Env): LifeEvent[] {
  const ev: LifeEvent[] = [];
  v.t += dt;
  const hours = dt / HOUR_SECONDS;
  const mins = hours * 60;
  for (const a of v.agents) {
    a.needs = decay(a.needs, a.kind, hours);
    if (a.state === "idle") {
      if ((a.idle -= dt) > 0) continue;
      const c = choose(a, v, env);
      if (c) begin(a, c, v, env);
      else a.idle = 0.4;
      continue;
    }
    if (a.state === "walk") {
      const s = stepToward(a.pos, a.target, SPEED[a.kind] * dt);
      const next = slide(a.pos, s.dx, s.dz, env.canWalk);
      const stuck = next.x === a.pos.x && next.z === a.pos.z && !s.arrived;
      a.pos = next;
      if (s.arrived || stuck || Math.hypot(a.target.x - a.pos.x, a.target.z - a.pos.z) < ARRIVE) {
        const g = a.gather !== null ? v.gatherings.find((x) => x.id === a.gather) : undefined;
        if (g?.started) {
          // joined a game already running: play for what is left of it
          const mates = v.agents.filter((o) => o !== a && o.gather === g.id && o.state === "do");
          a.left = Math.min(a.left, ...mates.map((o) => o.left));
          a.state = "do";
          ev.push({ kind: "start", who: a.id, act: a.act!, with: mates.map((o) => o.id) });
        } else if (g) a.state = "wait";
        else {
          a.state = "do";
          ev.push({ kind: "start", who: a.id, act: a.act!, with: [] });
        }
      }
      continue;
    }
    if (a.state === "do") {
      const def = ACTIVITY.get(a.act!)!;
      const used = Math.min(mins, a.left);
      a.needs = applyEffects(a.needs, def.fx, used / def.minutes);
      a.left -= used;
      if (a.left > 0) continue;
      const g = a.gather !== null ? v.gatherings.find((x) => x.id === a.gather) : undefined;
      const mates = g ? g.members.filter((m) => m !== a.id) : [];
      for (const m of mates) bump(v.rel, a.id, m, 3);
      if (def.makes === "poop") {
        const id = v.nextId++;
        v.messes.push({ id, pos: { ...a.pos }, by: a.id });
        ev.push({ kind: "mess", who: a.id, id });
      }
      if (def.id === "clean" && a.mess !== null) {
        const id = a.mess;
        v.messes = v.messes.filter((m) => m.id !== id);
        ev.push({ kind: "cleaned", who: a.id, id });
      }
      ev.push({ kind: "done", who: a.id, act: def.id, with: mates });
      stop(a);
    }
  }
  // Gatherings: start once enough members are waiting there; cancel when nobody came in time.
  for (const g of v.gatherings) {
    if (g.started) continue;
    const def = ACTIVITY.get(g.act)!;
    const here = v.agents.filter((a) => a.gather === g.id && a.state === "wait");
    if (here.length >= def.min && here.length === g.members.length) {
      g.started = true;
      for (const a of here) {
        a.state = "do";
        ev.push({ kind: "start", who: a.id, act: g.act, with: here.filter((o) => o !== a).map((o) => o.id) });
      }
    } else if (v.t > g.deadline && here.length < def.min) {
      for (const a of v.agents.filter((x) => x.gather === g.id)) {
        ev.push({ kind: "cancel", who: a.id, act: g.act });
        stop(a);
      }
      g.members = [];
      g.started = true; // closed
    }
  }
  v.gatherings = v.gatherings.filter((g) => !g.started || v.agents.some((a) => a.gather === g.id));
  // A mess a player cleaned (or that vanished) frees its cleaner.
  for (const a of v.agents) if (a.mess !== null && !v.messes.some((m) => m.id === a.mess)) stop(a);
  return ev;
}

// The player sweeps a mess up (E next to it).
export function cleanMess(v: Village, id: number): boolean {
  const n = v.messes.length;
  v.messes = v.messes.filter((m) => m.id !== id);
  return v.messes.length < n;
}
