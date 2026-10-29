// The village people (Elder, Mo, Ama, Pip) live in a small sim of their own on the hub. Every machine runs
// that sim so it can draw them, but only the NPC's host (picked by the room from local model speed) runs
// its mind: the host's choices go out as `mind` act lines and the other machines replay them; the host's
// spoken lines and memories go out too, so a host change keeps the NPC's memory (stored in the room).
// No host known (offline, alone) = the NPCs pick by the utility score here, like a mind without a model.

import { clockLabel, gameTime } from "../life/clock";
import { addAgent, newVillage, stepVillage, type Agent, type Choice, type Env, type LifeEvent, type Spots, type Village } from "../life/village";
import type { Vec } from "../world/movement";
import { NPCS, type MindLine, type Npc } from "../world/live";
import { MindHub } from "./hub";
import { linePrompt, parseLine, replyPrompt, scriptedLine } from "./brain";
import { emptyMemory, remember, type MemoryEntry, type MindMemory } from "./memory";
import { VILLAGERS, type Persona } from "./persona";
import { pairKey } from "../life/relations";
import { PRIO, type MindScheduler } from "./scheduler";

export interface NpcOut {
  line(l: MindLine & { mem?: string }): void; // to the room (only for NPCs I host)
  say(id: Npc, text: string): void; // a bubble over the NPC here
}

const REMOTE_WAIT = 20; // seconds a replaying NPC waits for its host's choice before deciding itself
const GREET_DIST = 3; // a player this close may get greeted
const GREET_GAP = 180; // sim seconds before the same NPC greets the same player again
const CHAT_DIST = 2.6; // two NPCs this close (hosted on different machines) may chat over the room
const CHAT_GAP = 120; // sim seconds between two such chats of one NPC
const CHAT_TURNS = 3; // lines each side says at most
const SCRIPT_GAP_MS = 3200; // without a model, wait a little before answering (the room allows 1 line / 3 s)

// Someone the NPCs can see: a player here or online (id = live id; "me" before the room knows mine).
export interface Person {
  id: string;
  name: string;
  pos: Vec;
}

export class NpcVillage {
  readonly v = newVillage();
  readonly env: Env;
  readonly hub: MindHub; // holds only the minds I host
  private readonly hosts = new Map<Npc, string | null>();
  private readonly remote = new Map<string, string>(); // npc -> act its host started
  private readonly waited = new Map<string, number>(); // npc -> sim time it started waiting for its host
  private readonly sent = new Map<string, MemoryEntry | null>(); // npc -> last memory entry sent to the room
  private readonly mems = new Map<Npc, MindMemory>(); // memories handed over (npcState) before hosting
  private myId: string | null = null;
  people: () => Person[] = () => []; // players around (me + online peers), for greetings
  private readonly greeted = new Map<string, number>(); // "npc:player" -> sim time of the greeting
  private readonly lastChat = new Map<Npc, number>(); // sim time of the NPC's last NPC chat
  private readonly chats = new Map<Npc, { with: Npc; said: string[]; turns: number }>(); // NPC chats over the room
  private readonly busy = new Set<Npc>(); // a line is being made

  constructor(
    private readonly sched: MindScheduler,
    private readonly hasModel: () => boolean,
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
    for (const n of NPCS) this.setHost(n, null);
  }

  setSpots(spots: Spots): void {
    this.env.spots = spots;
    this.hub.setPlaces(new Set(Object.keys(spots) as (keyof Spots)[]));
  }

  // My live id (null = not in a room). Changing it re-checks which minds run here.
  get me(): string | null {
    return this.myId;
  }
  set me(id: string | null) {
    this.myId = id;
    for (const n of NPCS) this.setHost(n, this.hosts.get(n) ?? null);
  }

  // Offline (no room) the NPCs' minds run here; in a room only the ones the room gave me.
  hosting(npc: Npc): boolean {
    return this.myId ? this.hosts.get(npc) === this.myId : !this.hosts.get(npc);
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
    // Another machine's NPC spoke to an NPC I host: mine answers (a few turns at most).
    const to = l.to as Npc | undefined;
    if (l.say && to && NPCS.includes(to) && this.hosting(to)) {
      const c = this.chats.get(to)?.with === npc ? this.chats.get(to)! : { with: npc, said: [], turns: 0 };
      c.said.push(`${VILLAGERS.find((p) => p.id === npc)!.name}: ${l.say}`);
      this.chats.set(to, c);
      if (c.turns < CHAT_TURNS) void this.speak(to, VILLAGERS.find((p) => p.id === npc)!, npc, c);
    }
  }

  // The NPC says one line to someone (a player or another NPC), from its own mind when a model is here.
  private async speak(npc: Npc, other: Persona, to: string, c: { said: string[]; turns: number }): Promise<void> {
    const m = this.hub.minds.get(npc);
    if (!m || this.busy.has(npc)) return;
    this.busy.add(npc);
    this.hold(npc);
    c.turns++;
    try {
      const aff = this.v.rel.get(pairKey(npc, other.id)) ?? 0;
      const topic = c.said.length ? "what was just said" : m.mem.log.at(-1)?.text ?? "the day on the islands";
      const ans = this.hasModel()
        ? await this.sched.ask({ prio: PRIO.talk, timeoutMs: 20000, req: linePrompt(m.persona, m.mem, other, aff, topic, c.said), parse: (t) => parseLine(t, m.persona.name), fallback: () => scriptedLine(m.persona, other, c.said.length, this.v.nextId) })
        : (await new Promise((r) => setTimeout(r, SCRIPT_GAP_MS)), { value: scriptedLine(m.persona, other, c.said.length, this.v.nextId), source: "rules" });
      if (!this.hosting(npc)) return; // moved to another host meanwhile
      c.said.push(`${m.persona.name}: ${ans.value}`);
      m.source = ans.source;
      this.out.say(npc, ans.value);
      this.out.line({ who: npc, say: ans.value, to });
      const g = gameTime(this.v.t);
      if (c.said.length <= 2) remember(m.mem, g.day, clockLabel(g.hour), `talked with ${other.name}`);
    } finally {
      this.busy.delete(npc);
    }
  }

  // Hosted NPCs who feel like it start a talk: a player walking by gets greeted, an NPC hosted on another
  // machine standing close gets a line (its host's mind answers through the room).
  private social(): void {
    for (const a of this.v.agents) {
      const npc = a.id as Npc;
      if (!this.hosting(npc) || this.busy.has(npc) || this.hub.minds.get(npc)?.talking) continue;
      if (!(a.state === "idle" || (a.state === "do" && a.act === "wander"))) continue;
      const near = (p: Vec, d: number) => Math.hypot(p.x - a.pos.x, p.z - a.pos.z) < d;
      const guest = this.people().find((p) => near(p.pos, GREET_DIST) && this.v.t - (this.greeted.get(`${npc}:${p.id}`) ?? -1e9) > GREET_GAP);
      if (guest) {
        this.greeted.set(`${npc}:${guest.id}`, this.v.t);
        const visitor: Persona = { id: guest.id, name: guest.name, kind: "human", traits: [], hobbies: [], habit: "", background: "" };
        void this.speak(npc, visitor, guest.id === "me" ? "" : guest.id, { said: [], turns: 0 });
        continue;
      }
      if (a.needs.social > 70 || this.v.t - (this.lastChat.get(npc) ?? -1e9) < CHAT_GAP) continue;
      const mate = this.v.agents.find((o) => o !== a && !this.hosting(o.id as Npc) && this.hosts.get(o.id as Npc) && near(o.pos, CHAT_DIST));
      if (!mate) continue;
      const c = { with: mate.id as Npc, said: [] as string[], turns: 0 };
      this.chats.set(npc, c);
      this.lastChat.set(npc, this.v.t);
      void this.speak(npc, VILLAGERS.find((p) => p.id === mate.id)!, mate.id, c);
    }
  }

  private choose(npc: Npc, a: Agent, cs: Choice[], v: Village): string | null | undefined {
    if (this.hosting(npc)) return this.hub.chooser(a, cs);
    const host = this.hosts.get(npc);
    if (!host) return null; // nobody runs this mind: utility here
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

  // A player is talking to this NPC: if it is between activities, it waits a moment instead of leaving.
  hold(npc: Npc): void {
    const a = this.v.agents.find((x) => x.id === npc);
    if (a?.state === "idle") a.idle = Math.max(a.idle, 15);
  }

  // The player talks to an NPC. Hosted here with a model: its own mind answers (persona + memories) and
  // remembers the chat, which reaches the room as a memory line. Otherwise null: the caller asks the cloud.
  // `to` = the asker's live id when the question came through the room (their game shows the answer).
  async reply(npc: Npc, player: string, line: string, to?: string): Promise<{ text: string; source: string } | null> {
    const m = this.hub.minds.get(npc);
    this.hold(npc);
    if (!m || !this.hosting(npc) || !this.hasModel()) return null;
    const ans = await this.sched.ask({ prio: PRIO.talk, timeoutMs: 25000, req: replyPrompt(m.persona, m.mem, player, line), parse: (t) => parseLine(t, m.persona.name), fallback: () => null as string | null });
    if (!ans.value) return null;
    const g = gameTime(this.v.t);
    remember(m.mem, g.day, clockLabel(g.hour), `${player} asked "${line.slice(0, 40)}", I said "${ans.value.slice(0, 40)}"`);
    if (this.hosting(npc)) this.out.line(to ? { who: npc, say: ans.value, to } : { who: npc, say: ans.value });
    return { text: ans.value, source: ans.source };
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
    this.social();
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
