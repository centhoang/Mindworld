// The minds on this machine, wired to the life sim: each agent with a persona gets a memory, a daily plan,
// model-picked activities (from the sim's valid choices only), talk with nearby minds, emotes after
// shared fun, and a reflection before sleep. All model calls go through the one MindScheduler; every
// decision has a fallback, so the village lives the same way without a model (just less personal).

import { ACTIVITY, type Place } from "../life/activities";
import { clockLabel, gameTime, type Phase } from "../life/clock";
import { fullNeeds, NEEDS, type Needs } from "../life/needs";
import { bump, pairKey } from "../life/relations";
import type { Agent, Choice, LifeEvent, Village } from "../life/village";
import type { Emote } from "../world/live";
import { choosePrompt, emotePrompt, eventText, linePrompt, parseChoice, parseEmote, parseLine, parsePlan, planPrompt, PLAN_PHASES, reflectPrompt, scriptedLine } from "./brain";
import { addFact, emptyMemory, parseMemory, remember, type MindMemory } from "./memory";
import { traitBias, type Persona } from "./persona";
import { PRIO, type MindScheduler } from "./scheduler";

export interface Mind {
  persona: Persona;
  mem: MindMemory;
  source: string; // who answered the last decision: a model label or "rules"
  thinking: string; // "" or what it is deciding right now
  pending: { key: string; value?: string | null } | null;
  lastTalk: number; // sim seconds
  talking: boolean;
}

export interface HubOut {
  say(id: string, text: string): void;
  emote?(id: string, e: Emote): void;
  invite?(id: string, act: string): void; // a mind's group plan just spread: tell the room
}

const TALK_GAP = 90; // sim seconds between two talks of the same mind
const TALK_DIST = 2.6;
const TOP_CHOICES = 5;
const EMOTE_TEXT: Record<Emote, string> = { wave: "*waves*", heart: "<3", dance: "*dances*", laugh: "haha!" };

export class MindHub {
  readonly minds = new Map<string, Mind>();

  constructor(
    private readonly v: Village,
    private readonly sched: MindScheduler,
    private readonly out: HubOut,
    private readonly hasModel: () => boolean,
    private readonly places: ReadonlySet<Place> = new Set(["home", "bowl", "bed", "lawn"]), // spots this ground has
  ) {}

  add(p: Persona, mem: MindMemory = emptyMemory()): Mind {
    const m: Mind = this.minds.get(p.id) ?? { persona: p, mem, source: "rules", thinking: "", pending: null, lastTalk: -TALK_GAP, talking: false };
    m.persona = p;
    this.minds.set(p.id, m);
    return m;
  }

  remove(id: string): void {
    this.minds.delete(id);
  }

  private now() {
    const g = gameTime(this.v.t);
    return { ...g, time: clockLabel(g.hour) };
  }

  // Env.bias for the sim: personality nudges the utility scores.
  readonly bias = (a: Agent, act: string): number => {
    const m = this.minds.get(a.id);
    return m ? traitBias(m.persona, act) : 0;
  };

  // Env.chooser for the sim. Returns the model's pick once it is in, undefined while it is thinking,
  // null to take the best utility score (no mind, no model, or the model was too slow/invalid).
  readonly chooser = (a: Agent, cs: Choice[]): string | null | undefined => {
    const m = this.minds.get(a.id);
    if (!m || m.talking) return m?.talking ? undefined : null;
    if (!this.hasModel()) return null;
    const top = cs.slice(0, TOP_CHOICES).map((c) => c.act);
    if (top.length < 2) return null;
    const key = `${a.id}:${top.join(",")}`;
    if (m.pending?.key === key) {
      if (m.pending.value === undefined) return undefined;
      const val = m.pending.value;
      m.pending = null;
      return val;
    }
    const pend: { key: string; value?: string | null } = { key };
    m.pending = pend;
    m.thinking = "what to do next";
    const now = this.now();
    const company = this.nearby(a).map((o) => o.persona.name);
    void this.sched
      .ask({
        prio: PRIO.choose,
        timeoutMs: 12000,
        req: choosePrompt(m.persona, m.mem, a.needs, now.phase, top, company.length ? `Nearby: ${company.join(", ")}.` : ""),
        parse: (t) => parseChoice(t, top),
        fallback: () => null as string | null,
      })
      .then((ans) => {
        pend.value = ans.value;
        m.source = ans.source;
        m.thinking = "";
      });
    return undefined;
  };

  private nearby(a: Agent): Mind[] {
    return this.v.agents
      .filter((o) => o !== a && Math.hypot(o.pos.x - a.pos.x, o.pos.z - a.pos.z) < 6)
      .map((o) => this.minds.get(o.id))
      .filter((m): m is Mind => !!m);
  }

  // Sim events become memories; shared fun may end in an emote.
  onEvents(ev: readonly LifeEvent[]): void {
    const now = this.now();
    for (const e of ev) {
      const m = this.minds.get(e.who);
      if (!m) continue;
      const names = (ids: readonly string[]) => ids.map((id) => this.minds.get(id)?.persona.name ?? id);
      if (e.kind === "done" && e.act !== "wander") {
        remember(m.mem, now.day, now.time, eventText(e.act, names(e.with)));
        if (e.with.length) this.askEmote(e.who, `${m.persona.name} just ${eventText(e.act, names(e.with))}.`);
      }
      if (e.kind === "cancel") remember(m.mem, now.day, now.time, `wanted to ${ACTIVITY.get(e.act)?.id ?? e.act} but nobody came`);
      if (e.kind === "cleaned") remember(m.mem, now.day, now.time, "cleaned up a mess on the lawn");
    }
  }

  private askEmote(id: string, situation: string): void {
    const m = this.minds.get(id);
    if (!m || !this.hasModel()) return;
    void this.sched.ask({ prio: PRIO.emote, timeoutMs: 5000, req: emotePrompt(m.persona, situation), parse: parseEmote, fallback: () => null }).then((a) => {
      if (!a.value) return;
      this.out.say(id, EMOTE_TEXT[a.value]);
      this.out.emote?.(id, a.value);
    });
  }

  // Once per frame: morning plans, bedtime reflections, and talk between minds that meet.
  tick(): void {
    this.sched.pump();
    const now = this.now();
    const options = [...new Set([...ACTIVITY.values()].filter((d) => d.id !== "poop" && d.id !== "sleep" && this.places.has(d.place)).map((d) => d.id))];
    for (const a of this.v.agents) {
      const m = this.minds.get(a.id);
      if (!m) continue;
      if (m.mem.planDay < now.day && now.phase !== "night") this.makePlan(a, m, now.day, options.filter((o) => ACTIVITY.get(o)!.who === "any" || ACTIVITY.get(o)!.who === a.kind));
      if (m.mem.reflectDay < now.day && a.state === "do" && a.act === "sleep") this.reflect(m, now.day);
    }
    this.maybeTalk();
  }

  private makePlan(a: Agent, m: Mind, day: number, options: string[]): void {
    m.mem.planDay = day; // ask once, even if the answer is late
    const fallback = (): Partial<Record<Phase, string[]>> => {
      // needs-based default: the activities the persona likes most
      const ranked = [...options].sort((x, y) => traitBias(m.persona, y) - traitBias(m.persona, x));
      return { morning: [ranked[0]!], noon: [ranked[1] ?? ranked[0]!], evening: [ranked[2] ?? ranked[0]!] };
    };
    if (!this.hasModel()) {
      m.mem.plan = fallback();
      a.plan = m.mem.plan;
      return;
    }
    m.thinking = "planning the day";
    void this.sched.ask({ prio: PRIO.plan, timeoutMs: 20000, req: planPrompt(m.persona, m.mem, options), parse: (t) => parsePlan(t, options), fallback }).then((ans) => {
      m.mem.plan = ans.value;
      a.plan = ans.value;
      m.source = ans.source;
      m.thinking = "";
      const p = ans.value;
      remember(m.mem, day, this.now().time, `planned: ${PLAN_PHASES.map((ph) => p[ph]?.[0] ?? "-").join(", ")}`);
    });
  }

  private reflect(m: Mind, day: number): void {
    m.mem.reflectDay = day;
    if (!this.hasModel()) return;
    void this.sched.ask({ prio: PRIO.reflect, timeoutMs: 30000, req: reflectPrompt(m.persona, m.mem, day), parse: (t) => parseLine(t, m.persona.name), fallback: () => null as string | null }).then((ans) => {
      if (ans.value) addFact(m.mem, ans.value);
    });
  }

  // Two free minds close together, one of them feeling social: a short talk (2-4 lines).
  private maybeTalk(): void {
    const free = this.v.agents.filter((a) => {
      const m = this.minds.get(a.id);
      return m && !m.talking && this.v.t - m.lastTalk > TALK_GAP && (a.state === "idle" || (a.state === "do" && (a.act === "wander" || a.act === "groom")));
    });
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        const [a, b] = [free[i]!, free[j]!];
        if (Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) > TALK_DIST) continue;
        if (Math.min(a.needs.social, b.needs.social) > 70) continue;
        void this.talk(a, b);
        return;
      }
    }
  }

  async talk(a: Agent, b: Agent): Promise<void> {
    const [ma, mb] = [this.minds.get(a.id)!, this.minds.get(b.id)!];
    ma.talking = mb.talking = true;
    ma.lastTalk = mb.lastTalk = this.v.t;
    for (const x of [a, b]) if (x.state === "idle") x.idle = 999; // hold still while talking
    const topic = this.topic(ma);
    const said: string[] = [];
    const turns = 2 + (this.v.nextId % 3);
    const aff = this.v.rel.get(pairKey(a.id, b.id)) ?? 0;
    try {
      for (let k = 0; k < turns; k++) {
        const [sp, ls] = k % 2 ? [mb, ma] : [ma, mb];
        if (this.hasModel()) this.out.say(sp.persona.id, "..."); // typing while the model thinks
        const ans = this.hasModel()
          ? await this.sched.ask({ prio: PRIO.talk, timeoutMs: 25000, req: linePrompt(sp.persona, sp.mem, ls.persona, aff, topic, said), parse: (t) => parseLine(t, sp.persona.name), fallback: () => scriptedLine(sp.persona, ls.persona, k, this.v.nextId) })
          : { value: scriptedLine(sp.persona, ls.persona, k, this.v.nextId + k), source: "rules" };
        sp.source = ans.source;
        said.push(`${sp.persona.name}: ${ans.value}`);
        this.out.say(sp.persona.id, ans.value);
        if (!this.hasModel()) await new Promise((r) => setTimeout(r, 2200));
      }
      const now = this.now();
      remember(ma.mem, now.day, now.time, `talked with ${mb.persona.name} about ${topic}`);
      remember(mb.mem, now.day, now.time, `talked with ${ma.persona.name} about ${topic}`);
      bump(this.v.rel, a.id, b.id, 2);
      this.spreadPlan(ma, mb, b, aff);
      for (const x of [a, b]) x.needs = { ...x.needs, social: Math.min(100, x.needs.social + 20) };
    } finally {
      ma.talking = mb.talking = false;
      for (const x of [a, b]) if (x.state === "idle") x.idle = 1;
    }
  }

  // What the opener talks about: a group plan coming up (an invitation), else the latest memory.
  private topic(m: Mind): string {
    const ph = this.now().phase;
    const next = PLAN_PHASES[PLAN_PHASES.indexOf(ph as (typeof PLAN_PHASES)[number]) + 1] ?? "evening";
    const act = m.mem.plan[next]?.[0];
    if (act && (ACTIVITY.get(act)?.min ?? 1) > 1) return `${ACTIVITY.get(act)!.label.replace(/s\b/, "")} this ${next}`;
    const last = m.mem.log[m.mem.log.length - 1];
    return last ? last.text : "the weather";
  }

  // An invitation spreads: a friend who heard about a group plan adds it to their own plan.
  private spreadPlan(from: Mind, to: Mind, toAgent: Agent, aff: number): void {
    if (aff < 0) return;
    for (const ph of PLAN_PHASES) {
      const act = from.mem.plan[ph]?.[0];
      if (!act || (ACTIVITY.get(act)?.min ?? 1) < 2) continue;
      if (to.mem.plan[ph]?.includes(act)) continue;
      to.mem.plan = { ...to.mem.plan, [ph]: [act, ...(to.mem.plan[ph] ?? [])].slice(0, 2) };
      toAgent.plan = to.mem.plan;
      remember(to.mem, this.now().day, this.now().time, `${from.persona.name} invited me to ${ACTIVITY.get(act)!.id} this ${ph}`);
      this.out.invite?.(from.persona.id, act);
      return;
    }
  }

  // An invitation from another player's pet (live room): the least busy of my minds who does not have it
  // yet adds the group activity to its next plan slot. Returns who took it, if anyone.
  heardInvite(fromName: string, act: string): string | null {
    const def = ACTIVITY.get(act);
    if (!def || def.min < 2) return null;
    const ph = this.now().phase;
    const next = PLAN_PHASES[PLAN_PHASES.indexOf(ph as (typeof PLAN_PHASES)[number]) + 1] ?? "morning";
    const pick = [...this.minds.values()].filter((m) => !m.mem.plan[next]?.includes(act)).sort((a, b) => (a.mem.plan[next]?.length ?? 0) - (b.mem.plan[next]?.length ?? 0))[0];
    if (!pick) return null;
    pick.mem.plan = { ...pick.mem.plan, [next]: [act, ...(pick.mem.plan[next] ?? [])].slice(0, 2) };
    const agent = this.v.agents.find((a) => a.id === pick.persona.id);
    if (agent) agent.plan = pick.mem.plan;
    remember(pick.mem, this.now().day, this.now().time, `${fromName} from next door invited me to ${def.id} this ${next}`);
    return pick.persona.id;
  }

  // --- save -----------------------------------------------------------------------------------------
  snapshot(): MindsSave {
    const minds: MindsSave["minds"] = {};
    for (const [id, m] of this.minds) {
      const a = this.v.agents.find((x) => x.id === id);
      minds[id] = { mem: m.mem, needs: a?.needs };
    }
    return { t: this.v.t, rel: [...this.v.rel.entries()], minds };
  }
}

export interface MindsSave {
  t: number;
  rel: [string, number][];
  minds: Record<string, { mem: MindMemory; needs?: Needs }>;
}

export const MINDS_KEY = "petmind.minds.v1";

export function parseMindsSave(raw: unknown): MindsSave | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<MindsSave>;
  const out: MindsSave = { t: typeof r.t === "number" && r.t >= 0 ? r.t : 0, rel: [], minds: {} };
  if (Array.isArray(r.rel)) out.rel = r.rel.filter((x): x is [string, number] => Array.isArray(x) && typeof x[0] === "string" && typeof x[1] === "number").slice(0, 200);
  if (r.minds && typeof r.minds === "object") {
    for (const [id, m] of Object.entries(r.minds).slice(0, 40)) {
      const needs = fullNeeds();
      const rn = (m as { needs?: Record<string, unknown> })?.needs;
      if (rn) for (const k of NEEDS) if (typeof rn[k] === "number") needs[k] = Math.max(0, Math.min(100, rn[k] as number));
      out.minds[id] = { mem: parseMemory((m as { mem?: unknown })?.mem), needs };
    }
  }
  return out;
}
