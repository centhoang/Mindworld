// The village people (Elder, Mo, Ama, Pip) live in a small sim of their own on the hub. Every machine runs
// that sim so it can draw them, but only the NPC's host (picked by the room from local model speed) runs
// its mind: the host's choices go out as `mind` act lines and the other machines replay them; the host's
// spoken lines and memories go out too, so a host change keeps the NPC's memory (stored in the room).
// No host known (offline, alone) = the NPCs pick by the utility score here, like a mind without a model.

import { gameTime, clockLabel } from "../life/clock";
import { addAgent, newVillage, stepVillage, type Agent, type Choice, type Env, type LifeEvent, type Spots, type Village } from "../life/village";
import type { Vec } from "../world/movement";
import { NPCS, type MindLine, type Npc } from "../world/live";
import { MindHub } from "./hub";
import { emptyMemory, type MemoryEntry, type MindMemory } from "./memory";
import { VILLAGERS } from "./persona";
import type { MindScheduler } from "./scheduler";

export interface NpcOut {
  line(l: MindLine & { mem?: string }): void; // to the room (only for NPCs I host)
  say(id: Npc, text: string): void; // a bubble over the NPC here
}

const REMOTE_WAIT = 20; // seconds a replaying NPC waits for its host's choice before deciding itself

export class NpcVillage {
  readonly v = newVillage();
  readonly env: Env;
  readonly hub: MindHub; // holds only the minds I host
  private readonly hosts = new Map<Npc, string | null>();
  private readonly remote = new Map<string, string>(); // npc -> act its host started
  private readonly waited = new Map<string, number>(); // npc -> sim time it started waiting for its host
  private readonly sent = new Map<string, MemoryEntry | null>(); // npc -> last memory entry sent to the room
  private readonly mems = new Map<Npc, MindMemory>(); // memories handed over (npcState) before hosting
  me: string | null = null; // my live id

  constructor(
    sched: MindScheduler,
    hasModel: () => boolean,
    private readonly out: NpcOut,
    homes: Record<Npc, Vec>,
    spots: Spots,
    canWalk: (x: number, z: number) => boolean,
    route?: (from: Vec, to: Vec) => Vec[] | null,
    rng: () => number = Math.random,
  ) {
    for (const p of VILLAGERS) addAgent(this.v, p.id, p.name, "human", homes[p.id as Npc] ?? { x: 0, z: 0 });
    this.hub = new MindHub(this.v, sched, { say: (id, text) => this.said(id as Npc, text) }, hasModel, new Set(Object.keys(spots) as (keyof Spots)[]));
    this.env = { spots, canWalk, route, rng, bias: this.hub.bias, chooser: (a, cs, v) => this.choose(a.id as Npc, a, cs, v) };
  }

  setSpots(spots: Spots): void {
    this.env.spots = spots;
    this.hub.setPlaces(new Set(Object.keys(spots) as (keyof Spots)[]));
  }

  hosting(npc: Npc): boolean {
    return !!this.me && this.hosts.get(npc) === this.me;
  }

  // The room's host map changed: start or stop running that NPC's mind here.
  setHost(npc: Npc, host: string | null): void {
    this.hosts.set(npc, host);
    const persona = VILLAGERS.find((p) => p.id === npc)!;
    if (this.hosting(npc)) {
      if (!this.hub.minds.has(npc)) {
        const m = this.hub.add(persona, this.mems.get(npc) ?? emptyMemory());
        this.sent.set(npc, m.mem.log.at(-1) ?? null);
      }
    } else if (this.hub.minds.has(npc)) {
      this.mems.set(npc, this.hub.minds.get(npc)!.mem);
      this.hub.remove(npc);
    }
    this.remote.delete(npc);
  }

  // The room handed me an NPC's memory (lines "08:10 text", oldest first).
  setMemory(npc: Npc, log: readonly string[]): void {
    const mem = emptyMemory();
    const day = gameTime(this.v.t).day;
    for (const l of log) {
      const m = /^(\d\d:\d\d) (.*)$/.exec(l);
      mem.log.push({ day, time: m ? m[1]! : "", text: (m ? m[2]! : l).slice(0, 100) });
    }
    const mind = this.hub.minds.get(npc);
    if (mind) {
      mind.mem.log = [...mem.log, ...mind.mem.log].slice(-30);
      this.sent.set(npc, mind.mem.log.at(-1) ?? null);
    } else this.mems.set(npc, mem);
  }

  // Another machine's line about an NPC: its host started an activity (replayed here) or spoke.
  hear(l: MindLine): void {
    const npc = l.who as Npc;
    if (!NPCS.includes(npc) || this.hosting(npc)) return;
    if (l.act) this.remote.set(npc, l.act);
    if (l.say) this.out.say(npc, l.say);
  }

  private choose(npc: Npc, a: Agent, cs: Choice[], v: Village): string | null | undefined {
    if (this.hosting(npc)) return this.hub.chooser(a, cs);
    const host = this.hosts.get(npc);
    if (!host || !this.me) return null; // nobody runs this mind: utility here
    const act = this.remote.get(npc);
    if (act) {
      this.remote.delete(npc);
      this.waited.delete(npc);
      return cs.some((c) => c.act === act) ? act : null;
    }
    const since = this.waited.get(npc) ?? v.t;
    this.waited.set(npc, since);
    if (v.t - since < REMOTE_WAIT) return undefined;
    this.waited.delete(npc);
    return null;
  }

  private said(npc: Npc, text: string): void {
    this.out.say(npc, text);
    if (text !== "..." && this.hosting(npc)) this.out.line({ who: npc, say: text });
  }

  // `t` = the sim clock to follow (the pets' clock, so day and night match on this screen).
  step(dt: number, t: number): LifeEvent[] {
    this.v.t = t - dt;
    const ev = stepVillage(this.v, dt, this.env);
    this.hub.onEvents(ev);
    this.hub.tick();
    for (const e of ev) if (e.kind === "start" && this.hosting(e.who as Npc)) this.out.line({ who: e.who, act: e.act });
    // New memories of the NPCs I host go to the room, so the next host remembers them.
    for (const [id, m] of this.hub.minds) {
      const last = this.sent.get(id) ?? null;
      const from = last ? m.mem.log.indexOf(last) + 1 : 0;
      for (const e of m.mem.log.slice(from)) this.out.line({ who: id, mem: `${e.time || clockLabel(gameTime(this.v.t).hour)} ${e.text}` });
      this.sent.set(id, m.mem.log.at(-1) ?? null);
    }
    return ev;
  }
}
