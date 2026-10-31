// The village people (Elder, Mo, Ama, Pip) live in a small sim of their own on the hub. Every machine runs
// that sim so it can draw them, but only the NPC's host (picked by the room from local model speed) runs
// its mind: the host's choices go out as `mind` act lines and the other machines replay them; the host's
// spoken lines and memories go out too, so a host change keeps the NPC's memory (stored in the room).
// No host known (offline, alone) = the NPCs pick by the utility score here, like a mind without a model.

import { ACTIVITY } from "../life/activities";
import { clockLabel, gameTime } from "../life/clock";
import { addAgent, newVillage, stepVillage, type Agent, type Choice, type Env, type LifeEvent, type Spots, type Village } from "../life/village";
import type { Vec } from "../world/movement";
import { NPCS, type MindLine, type Npc } from "../world/live";
import { MindHub, type Mind } from "./hub";
import { linePrompt, parseLine, petLinePrompt, replyPrompt, scriptedLine, scriptedPetLine } from "./brain";
import { addBelief, beliefFrom, beliefLine, bondLine, bondOf, feel, feelWord, gossipFrom, gossipLine, holdsGrudge, hurt, parseBeliefLine, parseBondLine, parseGossip, toneOf, toYou, wariness, whyAnswer } from "./bonds";
import { addFact, emptyMemory, remember, type MemoryEntry, type MindMemory } from "./memory";
import { traitBias, VILLAGERS, type Persona } from "./persona";
import { add as addGood, bestCrop, priceAnswer, boardRows, dealLine, dealPrompt, dealScore, giftLine, GROW_STEPS, HARVEST_YIELD, JOB_GOOD, judge, newMarket, newPurse, openDay, parseDeal, parseOffer, parsePurseLine, parseTradeLine, plantCrop, priceOf, purseLine, wantOf, record, sellStock, tradeLine, WORK_YIELD, type BoardRow, type Good, type Market, type Offer, type Purse, type Trade } from "./economy";
import { closeTo, goalAnswer, goalOf, reached, spare } from "./goals";
import { humanize } from "./human";
import { JOB_PULL, refuseLine, refusesChat, refusesDeal, shiftChoice, type Duty } from "./jobs";
import { addCommitment, answerLine, type Invite, decidePrompt, dueNow, extractPrompt, extractRules, inviteScore, missed, outcomeAffinity, outcomeMemory, parseDecision, parseExtract, parsePromiseLine, promiseLine, ruleDecision, settle, type Commitment } from "./promises";
import { bump, pairKey } from "../life/relations";
import { PRIO, type MindScheduler } from "./scheduler";

export interface NpcOut {
  line(l: MindLine & { mem?: string }): void; // to the room (only for NPCs I host)
  say(id: Npc, text: string, to?: string): void; // a bubble over the NPC here; `to` = who is spoken to, by name
  think?(id: Npc, text: string): void; // a thought bubble: only this screen sees it
}

const personaOf = (id: string): Persona | undefined => VILLAGERS.find((p) => p.id === id);
const SPOT_NAME: Record<string, string> = { lawn: "the lawn", picnic: "the picnic spot", playground: "the playground", pond: "the pond" }; // places told to a guest

const REMOTE_WAIT = 20; // seconds a replaying NPC waits for its host's choice before deciding itself
const GREET_DIST = 3; // a player this close may get greeted
const GREET_GAP = 180; // sim seconds before the same NPC greets the same player again
const CHAT_DIST = 2.6; // two NPCs this close (hosted on different machines) may chat over the room
const CHAT_GAP = 120; // sim seconds between two such chats of one NPC
const CHAT_TURNS = 3; // lines each side says at most
const PET_DIST = 3; // a resting pet this close may get a line
const PET_GAP = 180; // sim seconds before the same NPC talks to the same pet again
const PET_NPC_GAP = 30; // sim seconds between one NPC's pet lines (several pets around: not one after another)
const SCRIPT_GAP_MS = 3200; // without a model, wait a little before answering (the room allows 1 line / 3 s)
const PROMISE_PULL = 3; // score added to a promised activity while it is due: it beats any need
const PROMISE_DIST = 7; // the one who invited is here if they are this close
const PITCH_SKIP = 0.4; // most meetings are just a hello or a chat
const PITCH_SELL = 0.5; // how often a saver offers its stock instead of an invitation
const PITCH_ACTS = ["soccer", "dance", "picnic", "fish"];
const FARM_PULL = 0.5; // a villager short of coins or with a crop in the ground goes to its garden
const FARM_COINS = 30;
const YES = /^\s*(ok|okay|deal|yes|yep|sure|fine|agreed)\b/i;
const INVITE_HINT = /\b(party|birthday|danc|soccer|football|fish|picnic|lunch)/i; // only these lines cost a model call

// A pet the NPCs can see (mine, at home or following me, or an online player's). `busy` = walking or doing
// something, so it isn't spoken to.
export interface PetSeen {
  id: string;
  name: string;
  pos: Vec;
  busy?: boolean;
}

// Someone the NPCs can see: a player here or online (id = live id; "me" before the room knows mine).
export interface Person {
  id: string;
  name: string;
  pos: Vec;
}

// What the player owns, as far as a deal with a villager goes.
export interface Pocket {
  coins(): number;
  count(g: Good): number;
  change(coins: number, g: Good, n: number): void; // both signed
}

export type Deal = { ok: true } | { ok: false; npc: Npc; refused: boolean; text: string };

export class NpcVillage {
  readonly v = newVillage();
  readonly hasPet: Record<Npc, boolean> = { elder: false, mo: false, ama: false, pip: false };
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
  pets: () => PetSeen[] = () => []; // pets around, for a passing word
  private readonly petted = new Map<string, number>(); // "npc:pet" (and "npc" for its last pet line) -> sim time
  private readonly lastChat = new Map<Npc, number>(); // sim time of the NPC's last NPC chat
  private readonly chats = new Map<Npc, { with: Npc; said: string[]; turns: number }>(); // NPC chats over the room
  private readonly busy = new Set<Npc>(); // a line is being made
  private readonly leaving = new Set<string>(); // promises the NPC already set off for
  private readonly arrived = new Set<string>(); // promises the NPC turned up for
  private readonly wired = new Map<string, Set<string>>(); // npc -> bond and belief lines the room has
  private readonly raised = new Set<string>(); // grudges the NPC already brought up to the person's face
  private readonly told = new Set<string>(); // news already passed to a neighbour on another machine
  private readonly duties = new Map<string, Duty>(); // "npc:day:phase" -> what it chose for that shift
  readonly market: Market = newMarket();
  pocket: Pocket | null = null;
  private readonly offers = new Map<string, { o: Offer; price: number }>(); // "npc:player" -> the counter it made
  private readonly purses = new Map<string, string>(); // npc -> purse line the room has
  private readonly asked = new Map<string, Invite>(); // "npc:player" -> what it invited them to

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
    this.hub = new MindHub(this.v, sched, { say: (id, text, to) => this.said(id as Npc, text, to) }, hasModel, new Set(Object.keys(spots) as (keyof Spots)[]));
    this.env = { spots, canWalk, route, rng, bias: (a, act) => this.hub.bias(a, act) + (this.dueAct(a.id) === act ? PROMISE_PULL : 0) + (this.duty(a).work && personaOf(a.id)?.job?.act === act ? JOB_PULL : 0) + (act === "farm" ? this.farmPull(a.id) : 0), jobOf: (a) => personaOf(a.id)?.job?.act ?? null, chooser: (a, cs, v) => this.choose(a.id as Npc, a, cs, v) };
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
      const c = parsePromiseLine(l);
      if (c) {
        mem.promises = [...mem.promises.filter((o) => o.id !== c.id), c]; // the latest state of each promise
        continue;
      }
      const purse = parsePurseLine(l);
      if (purse) {
        mem.purse = purse;
        continue;
      }
      const bond = parseBondLine(l, day);
      if (bond) {
        mem.bonds[bond.who] = bond.bond; // the latest line wins
        continue;
      }
      const belief = parseBeliefLine(l, day);
      if (belief) {
        addBelief(mem, belief);
        continue;
      }
      const m = /^(\d\d:\d\d) (.*)$/.exec(l);
      mem.log.push({ day, time: m ? m[1]! : "", text: (m ? m[2]! : l).slice(0, 100) });
    }
    for (const [who, b] of Object.entries(mem.bonds)) if (!this.v.rel.has(pairKey(npc, who))) this.v.rel.set(pairKey(npc, who), b.fondness);
    if (npc === "pip" && (mem.purse?.goals ?? 0) >= 1) this.hasPet[npc] = true;
    const mind = this.hub.minds.get(npc);
    if (mind) {
      mind.mem.log = [...mem.log, ...mind.mem.log].slice(-30);
      mind.mem.promises = mem.promises;
      mind.mem.bonds = mem.bonds;
      mind.mem.beliefs = mem.beliefs;
      if (mem.purse) mind.mem.purse = mem.purse;
      this.sent.set(npc, mind.mem.log.at(-1) ?? null);
    } else this.mems.set(npc, mem);
  }

  // Another machine's line about an NPC: its host started an activity (replayed here) or spoke.
  hear(l: MindLine): void {
    const trade = l.trade ? parseTradeLine(l.trade) : null;
    if (trade) record(this.market, trade);
    const npc = l.who as Npc;
    if (!NPCS.includes(npc) || this.hosting(npc)) return;
    if (npc === "pip" && l.say?.includes("I bought a pet of my own")) this.hasPet[npc] = true;
    if (l.act) this.remote.set(npc, l.act);
    if (l.say) this.out.say(npc, l.say, VILLAGERS.find((p) => p.id === l.to)?.name ?? this.people().find((p) => p.id === l.to)?.name);
    // Another machine's NPC spoke to an NPC I host: mine answers (a few turns at most).
    const to = l.to as Npc | undefined;
    if (l.say && to && NPCS.includes(to) && this.hosting(to)) {
      const teller = personaOf(npc)!.name;
      const news = parseGossip(l.say, teller);
      if (news) this.hub.hearNews(this.hub.minds.get(to)!, teller, news.about, news.text);
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
        ? await this.sched.ask({ prio: PRIO.talk, timeoutMs: 20000, req: linePrompt(m.persona, m.mem, other, aff, topic, c.said, this.hub.sceneOf?.(npc) ?? ""), parse: (t) => parseLine(t, m.persona.name), fallback: () => scriptedLine(m.persona, other, c.said.length, this.v.nextId) })
        : (await new Promise((r) => setTimeout(r, SCRIPT_GAP_MS)), { value: scriptedLine(m.persona, other, c.said.length, this.v.nextId), source: "rules" });
      if (!this.hosting(npc)) return; // moved to another host meanwhile
      c.said.push(`${m.persona.name}: ${ans.value}`);
      m.source = ans.source;
      const say = humanize(ans.value, m.persona);
      // A line to another player is theirs alone: their machine shows it, the host's does not.
      if (!to || to === this.me || NPCS.includes(to as Npc)) this.out.say(npc, say, other.name);
      this.out.line({ who: npc, say, to });
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
        if (this.bringUp(npc, guest) || this.pitch(npc, guest)) continue;
        const visitor: Persona = { id: guest.id, name: guest.name, kind: "human", traits: [], hobbies: [], habit: "", background: "" };
        void this.speak(npc, visitor, guest.id === "me" ? "" : guest.id, { said: [], turns: 0 });
        continue;
      }
      const pet = this.v.t - (this.petted.get(npc) ?? -1e9) < PET_NPC_GAP ? undefined : this.pets().find((p) => !p.busy && near(p.pos, PET_DIST) && this.v.t - (this.petted.get(`${npc}:${p.id}`) ?? -1e9) > PET_GAP);
      if (pet) {
        this.petted.set(`${npc}:${pet.id}`, this.v.t);
        this.petted.set(npc, this.v.t);
        void this.petLine(npc, pet);
        continue;
      }
      if (a.needs.social > 70 || this.v.t - (this.lastChat.get(npc) ?? -1e9) < CHAT_GAP) continue;
      const mate = this.v.agents.find((o) => o !== a && !this.hosting(o.id as Npc) && this.hosts.get(o.id as Npc) && near(o.pos, CHAT_DIST));
      if (!mate) continue;
      this.lastChat.set(npc, this.v.t);
      if (this.passOn(npc, mate.id as Npc)) continue;
      const c = { with: mate.id as Npc, said: [] as string[], turns: 0 };
      this.chats.set(npc, c);
      void this.speak(npc, VILLAGERS.find((p) => p.id === mate.id)!, mate.id, c);
    }
  }

  // News for a neighbour whose mind runs on another machine: it goes out as a spoken line, once per piece of news.
  private passOn(npc: Npc, mate: Npc): boolean {
    const m = this.hub.minds.get(npc);
    const name = personaOf(mate)!.name;
    const news = m && gossipFrom(m.mem, m.persona, name);
    const key = `${npc}:${mate}:${news?.about}`;
    if (!news || this.told.has(key)) return false;
    this.told.add(key);
    const say = gossipLine(news.about, news.hop);
    this.out.say(npc, say, name);
    this.out.line({ who: npc, say, to: mate });
    return true;
  }

  // One line to a pet nearby: from the NPC's mind with a model here, else scripted. It goes to the room as a
  // plain spoken line (no `to`: pets don't answer), so every machine shows the bubble.
  private async petLine(npc: Npc, pet: PetSeen): Promise<void> {
    const m = this.hub.minds.get(npc);
    if (!m || this.busy.has(npc)) return;
    this.busy.add(npc);
    try {
      const k = this.v.nextId;
      const ans = this.hasModel()
        ? await this.sched.ask({ prio: PRIO.emote, timeoutMs: 15000, req: petLinePrompt(m.persona, m.mem, pet.name, this.hub.sceneOf?.(npc, pet.pos) ?? ""), parse: (t) => parseLine(t, m.persona.name), fallback: () => scriptedPetLine(m.persona, pet.name, k) })
        : { value: scriptedPetLine(m.persona, pet.name, k), source: "rules" };
      if (!this.hosting(npc)) return;
      m.source = ans.source;
      this.out.say(npc, ans.value, pet.name);
      this.out.line({ who: npc, say: ans.value });
      const g = gameTime(this.v.t);
      remember(m.mem, g.day, clockLabel(g.hour), `said hello to ${pet.name}`);
    } finally {
      this.busy.delete(npc);
    }
  }

  private choose(npc: Npc, a: Agent, cs: Choice[], v: Village): string | null | undefined {
    if (this.hosting(npc)) {
      const due = this.dueAct(npc) ?? (this.duty(a).work ? personaOf(npc)?.job?.act ?? null : null);
      return due && cs.some((c) => c.act === due) ? due : this.hub.chooser(a, cs);
    }
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

  // A player is talking to this NPC: between activities it waits instead of leaving, on the way it stops.
  hold(npc: Npc): void {
    const a = this.v.agents.find((x) => x.id === npc);
    if (a?.state === "idle") a.idle = Math.max(a.idle, 15);
    if (a?.state === "walk") a.pause = 4;
  }

  // The player talks to an NPC. Hosted here with a model: its own mind answers (persona + memories) and
  // remembers the chat, which reaches the room as a memory line. Otherwise null: the caller asks the cloud.
  // `to` = the asker's live id when the question came through the room (their game shows the answer).
  // `scene` = what the asker and the NPC both see on the asker's screen (relayed questions bring theirs).
  async reply(npc: Npc, player: string, line: string, to?: string, scene?: string): Promise<{ text: string; source: string } | null> {
    const m = this.hub.minds.get(npc);
    this.hold(npc);
    const g0 = gameTime(this.v.t);
    this.listen(npc, personaOf(npc)!, this.memOf(npc), player, line, g0.day);
    if (!m || !this.hosting(npc)) return null;
    // Grounded answers come straight from the sim: a free model line could contradict what was decided.
    const answer = whyAnswer(line, bondOf(m.mem, player), player) ?? this.coldShoulder(m, player, line) ?? this.quote(npc, line) ?? goalAnswer(line, goalOf(npc, this.purseOf(npc)), this.purseOf(npc)) ?? await this.traded(npc, m, player, line, to) ?? this.tookUp(npc, m, player, to ?? this.myId ?? "me", line) ?? await this.invited(npc, m, player, to ?? this.myId ?? "me", line);
    if (!this.hasModel() && !answer) return null;
    const ans = answer ? { value: answer, source: "rules" }
      : await this.sched.ask({ prio: PRIO.talk, timeoutMs: 25000, req: replyPrompt(m.persona, m.mem, player, line, scene ?? this.hub.sceneOf?.(npc) ?? ""), parse: (t) => parseLine(t, m.persona.name), fallback: () => null as string | null });
    if (!ans.value) return null;
    const g = gameTime(this.v.t);
    remember(m.mem, g.day, clockLabel(g.hour), `${player} asked "${line.slice(0, 40)}", I said "${ans.value.slice(0, 40)}"`);
    const say = answer ? ans.value : humanize(ans.value, m.persona); // the sim's answers stay exact
    if (this.hosting(npc)) this.out.line(to ? { who: npc, say, to } : { who: npc, say });
    return { text: say, source: ans.source };
  }

  // A shift is decided once, when it starts, and the reason stays in the NPC's memory.
  private duty(a: Agent): Duty {
    const p = personaOf(a.id);
    const g = gameTime(this.v.t);
    const key = `${a.id}:${g.day}:${g.phase}`;
    const known = this.duties.get(key);
    if (known || !p) return known ?? { work: false, why: "" };
    const m = this.hub.minds.get(a.id);
    const promised = m ? dueNow(m.mem.promises, g.day, g.phase)[0]?.from ?? "" : "";
    const purse = m?.mem.purse;
    const goal = purse ? goalOf(a.id, purse) : null;
    const d = shiftChoice(p, a.needs, g.phase, g.day, promised, purse && closeTo(goal, purse) ? goal!.what : "");
    this.duties.set(key, d);
    if (m && d.why) {
      m.mem.why = d.why;
      if (!d.work) remember(m.mem, g.day, clockLabel(g.hour), d.why.split(" > ").slice(1).join(", "));
      this.out.think?.(a.id as Npc, d.work ? `Time for work.` : d.why.split(" > ")[1]!);
    }
    return d;
  }

  // Memory of an NPC whether or not its mind runs here: a player's manners still count when someone else hosts it.
  private memOf(npc: Npc): MindMemory {
    const m = this.hub.minds.get(npc)?.mem ?? this.mems.get(npc) ?? emptyMemory();
    if (!this.hub.minds.has(npc)) this.mems.set(npc, m);
    return m;
  }

  // The player wants to trade at the stall: is the keeper there, and will it deal with them?
  dealWith(player: string): Deal {
    const keeper = VILLAGERS.find((p) => p.job?.act === "sell")!;
    const npc = keeper.id as Npc;
    const a = this.v.agents.find((x) => x.id === npc);
    if (!a) return { ok: true };
    const open = a.act === "sell" && a.state !== "walk";
    if (!open) return { ok: false, npc, refused: false, text: `The stall is closed. ${keeper.name} ${ACTIVITY.get(a.act ?? "")?.label ?? "is away"}. Open ${keeper.job!.phases.join(" and ")}.` };
    const mem = this.memOf(npc);
    const b = bondOf(mem, player);
    if (!refusesDeal(keeper, b)) return { ok: true };
    const text = refuseLine(b, player);
    const g = gameTime(this.v.t);
    mem.why = `${b?.why.at(-1)?.text ?? "bad blood"} > ${b ? feelWord(b) : "wary of"} ${player} > refused to deal`;
    remember(mem, g.day, clockLabel(g.hour), `refused to deal with ${player}`, 5);
    this.hold(npc);
    this.said(npc, text, player);
    return { ok: false, npc, refused: true, text };
  }

  // The home crate ships through the keeper too: someone it refuses gets no way around it. Null = fine.
  shipRefused(player: string): string | null {
    const keeper = VILLAGERS.find((p) => p.job?.act === "sell")!;
    return refusesDeal(keeper, bondOf(this.memOf(keeper.id as Npc), player)) ? `${keeper.name} won't take your goods. Go and make it up with ${keeper.name} at the stall.` : null;
  }

  // What a line tells the NPC about the speaker: how they treat it, and what they like.
  private listen(npc: Npc, p: Persona, mem: MindMemory, player: string, line: string, day: number): void {
    const tone = toneOf(line);
    if (tone === "sorry" ? bondOf(mem, player) : tone) bump(this.v.rel, npc, player, feel(mem, p, player, tone!, day, tone === "sorry" ? `${player} said sorry` : `${player} was ${tone} to me`));
    const belief = beliefFrom(line);
    if (belief) addBelief(mem, { about: player, text: belief, source: "", conf: 0.8, day });
  }

  // Far enough gone, the NPC does not chat at all. "Sorry" still gets through (and has just moved the bond).
  private coldShoulder(m: Mind, player: string, line: string): string | null {
    const b = bondOf(m.mem, player);
    if (toneOf(line) === "sorry" || !refusesChat(m.persona, b)) return null;
    const g = gameTime(this.v.t);
    m.mem.why = `${b!.why.at(-1)?.text ?? "bad blood"} > ${feelWord(b!)} ${player} > won't talk`;
    remember(m.mem, g.day, clockLabel(g.hour), `would not talk to ${player}`, 4);
    return `I have nothing to say to you, ${player}.`;
  }

  private quote(npc: Npc, line: string): string | null {
    openDay(this.market, gameTime(this.v.t).day, VILLAGERS);
    return priceAnswer(line, this.market, this.purseOf(npc));
  }

  // A villager's purse: it travels with the mind, and every villager starts with a little.
  purseOf(npc: string): Purse {
    const m = this.memOf(npc as Npc);
    return (m.purse ??= newPurse());
  }

  board(): BoardRow[] {
    openDay(this.market, gameTime(this.v.t).day, VILLAGERS);
    return boardRows(this.market);
  }

  // Goods shipped through the crate reach the same market as everyone else's.
  shipped(who: string, sold: readonly { good: Good; qty: number; price: number }[]): void {
    for (const s of sold) this.trade({ who, ...s });
  }

  private trade(t: Trade, by: Npc = NPCS[0]!): void {
    record(this.market, t);
    this.out.line({ who: by, mem: tradeLine(t) });
  }

  // The player offers a gift or a deal in their own words. The sim settles what is possible; with a model, the NPC
  // chooses among what is left. Returns the answer, or null if the line is no offer.
  private async traded(npc: Npc, m: Mind, player: string, line: string, to?: string): Promise<string | null> {
    const key = `${npc}:${player}`;
    const pending = this.offers.get(key);
    if (pending) {
      this.offers.delete(key);
      if (YES.test(line)) return this.closeDeal(npc, m, player, pending.o, pending.price);
    }
    const o = parseOffer(line);
    if (!o) return null;
    const pocket = !to ? this.pocket : null;
    if (!pocket) return `Bring it to me in person, ${player}.`;
    const g = gameTime(this.v.t);
    openDay(this.market, g.day, VILLAGERS);
    const purse = this.purseOf(npc);
    const bond = bondOf(m.mem, player);
    const goal = goalOf(npc, purse);
    const v = judge(m.persona, bond, purse, this.market, o, player, pocket.coins(), pocket.count(o.good), goal && closeTo(goal, purse) ? { what: goal.what, spare: spare(purse) } : undefined);
    if (v.answer === "refuse") {
      m.mem.why = `${player} offered ${o.good} > ${v.why}`;
      remember(m.mem, g.day, clockLabel(g.hour), `turned down ${player}'s ${o.kind} of ${o.good}`, 4);
      return v.why;
    }
    if (o.kind === "gift") return this.takeGift(npc, m, player, o);
    this.out.think?.(npc, `Is that a fair price?`);
    const answer = v.fixed || !this.hasModel() ? v.answer
      : (await this.sched.ask({ prio: PRIO.talk, timeoutMs: 15000, req: dealPrompt(m.persona, o, v, player, dealScore(m.persona, bond)), parse: parseDeal, fallback: () => v.answer })).value;
    if (answer === "accept" && v.answer === "accept") return this.closeDeal(npc, m, player, o, v.price);
    if (answer === "refuse") {
      m.mem.why = `${v.why} > ${player} > refused the deal`;
      return dealLine("refuse", o, v.price, player);
    }
    this.offers.set(key, { o, price: v.price });
    m.mem.why = `${v.why} > offered ${v.price}c`;
    return dealLine("counter", o, v.price, player);
  }

  private takeGift(npc: Npc, m: Mind, player: string, o: Offer): string {
    const g = gameTime(this.v.t);
    const text = `${player} gave me ${o.qty} ${o.good}`;
    this.pocket!.change(0, o.good, -o.qty);
    addGood(this.purseOf(npc), o.good, o.qty);
    bump(this.v.rel, npc, player, feel(m.mem, m.persona, player, "gift", g.day, text));
    remember(m.mem, g.day, clockLabel(g.hour), text, 6);
    addBelief(m.mem, { about: player, text: `gives ${o.good}`, source: "", conf: 0.9, day: g.day });
    m.mem.why = `${text} > warmer to ${player}`;
    const line = giftLine(m.persona, o.good, this.market, player);
    this.market.wanted[o.good] = this.market.wanted[o.good]?.filter((n) => n !== m.persona.name);
    return line;
  }

  private closeDeal(npc: Npc, m: Mind, player: string, o: Offer, price: number): string {
    const g = gameTime(this.v.t);
    const purse = this.purseOf(npc);
    const pocket = this.pocket;
    const total = price * o.qty;
    const sells = o.kind === "sell"; // the player sells to the NPC
    if (!pocket || (sells ? pocket.count(o.good) < o.qty || purse.coins < total : pocket.coins() < total || (purse.goods[o.good] ?? 0) < o.qty)) return `That no longer works, ${player}.`;
    pocket.change(sells ? total : -total, o.good, sells ? -o.qty : o.qty);
    purse.coins += sells ? -total : total;
    addGood(purse, o.good, sells ? o.qty : -o.qty);
    this.trade({ who: sells ? player : m.persona.name, good: o.good, qty: sells ? o.qty : -o.qty, price }, npc);
    if (sells) this.market.wanted[o.good] = this.market.wanted[o.good]?.filter((n) => n !== m.persona.name);
    remember(m.mem, g.day, clockLabel(g.hour), `${sells ? "bought" : "sold"} ${o.qty} ${o.good} ${sells ? "from" : "to"} ${player} for ${total}c`, 5);
    m.mem.why = `${o.good} ${price}c each > fair > deal with ${player}`;
    return dealLine("accept", o, price, player);
  }

  private farmPull(npc: string): number {
    const p = this.hub.minds.get(npc)?.mem.purse;
    return !p || p.crop || p.coins < FARM_COINS ? FARM_PULL : 0;
  }

  // A hosted villager's work pays: goods from its job and garden, coins from the market at the end of the shift.
  private earn(e: Extract<LifeEvent, { kind: "start" | "done" }>): void {
    const m = this.hub.minds.get(e.who);
    if (!m || !this.hosting(e.who as Npc)) return;
    const g = gameTime(this.v.t);
    openDay(this.market, g.day, VILLAGERS);
    const purse = (m.mem.purse ??= newPurse());
    const time = clockLabel(g.hour);
    if (e.act === "farm" && e.kind === "start" && !purse.crop) {
      const pick = bestCrop(this.market, purse.coins);
      if (!pick) return;
      plantCrop(purse, pick.good);
      m.mem.why = pick.why;
      remember(m.mem, g.day, time, `planted ${pick.good}, it sells well`);
      this.out.think?.(e.who as Npc, `${pick.good[0]!.toUpperCase()}${pick.good.slice(1)} sells well. I'll plant some.`);
    }
    if (e.kind !== "done") return;
    const good = JOB_GOOD[e.act];
    if (good) {
      addGood(purse, good, WORK_YIELD);
      remember(m.mem, g.day, time, `got ${WORK_YIELD} ${good} from work`);
    }
    if (e.act === "farm" && purse.crop && ++purse.grown >= GROW_STEPS) {
      addGood(purse, purse.crop, HARVEST_YIELD);
      remember(m.mem, g.day, time, `harvested ${HARVEST_YIELD} ${purse.crop}`);
      purse.crop = null;
      purse.grown = 0;
    }
    // The stall closes: everyone on this machine sells to it.
    if (e.act === "sell") for (const [id, o] of this.hub.minds) {
      const p = (o.mem.purse ??= newPurse());
      for (const t of sellStock(this.market, p, o.persona)) {
        remember(o.mem, g.day, time, `sold ${t.qty} ${t.good} at the market for ${t.qty * t.price}c`, 4);
        this.out.line({ who: id, mem: tradeLine(t) });
      }
    }
  }

  // Is this line an invitation? If so the NPC decides from who it is and how it feels about the player, and an
  // accepted one becomes a promise. Returns the plain answer, for when no model words it.
  private async invited(npc: Npc, m: Mind, player: string, playerId: string, line: string): Promise<string | null> {
    if (!INVITE_HINT.test(line)) return null;
    const today = gameTime(this.v.t).day;
    const rules = extractRules(line, today);
    m.thinking = "whether to go";
    this.out.think?.(npc, `Should I go with ${player}?`);
    try {
      const said = this.hasModel()
        ? (await this.sched.ask({ prio: PRIO.talk, timeoutMs: 15000, req: extractPrompt(line), parse: (t) => parseExtract(t, today), fallback: () => rules })).value
        : rules;
      if (!said) return null;
      const invite = { ...said, occasion: rules?.occasion ?? "" };
      if (!this.env.spots[ACTIVITY.get(invite.act)!.place]?.length) {
        remember(m.mem, today, clockLabel(gameTime(this.v.t).hour), `${player} asked me to ${invite.act}, but there is nowhere for it here`);
        return `I would, ${player}, but there is nowhere to ${invite.act} around here.`;
      }
      const conflicts = dueNow(m.mem.promises, invite.day, invite.phase).length;
      const bond = bondOf(m.mem, player);
      const score = inviteScore(m.persona, (this.v.rel.get(pairKey(npc, player)) ?? 0) + wariness(bond), invite.act, conflicts);
      const grudge = holdsGrudge(bond);
      const chosen = this.hasModel()
        ? (await this.sched.ask({ prio: PRIO.talk, timeoutMs: 15000, req: decidePrompt(m.persona, m.mem, invite, player, score), parse: parseDecision, fallback: () => ruleDecision(score) })).value
        : ruleDecision(score);
      const decision = grudge && chosen === "accept" ? "counter" : chosen; // a hurt NPC promises nothing until it is made up
      const g = gameTime(this.v.t);
      if (decision === "accept") {
        const c: Commitment = { ...invite, id: `${npc}${this.v.nextId++}`, from: player, fromId: playerId, state: "open", importance: invite.occasion ? 8 : 5 };
        m.mem.promises = addCommitment(m.mem.promises, c);
        this.out.line({ who: npc, mem: promiseLine(c) });
      }
      const event = invite.occasion || invite.act;
      const did = decision === "accept" ? "promised to go" : decision === "counter" ? "asked for another time" : "said no";
      remember(m.mem, g.day, clockLabel(g.hour), `${player} invited me to ${event}, ${invite.day === g.day ? "today" : "tomorrow"} ${invite.phase}. I ${did}`, invite.occasion ? 7 : 5);
      const past = bond?.why.at(-1)?.text ?? "nothing between us yet";
      m.mem.why = `${past} > ${bond ? feelWord(bond) : "neutral about"} ${player} > ${did}`;
      feel(m.mem, m.persona, player, "invited", g.day, ""); // a small warmth, not a reason worth keeping
      const sore = grudge && bond ? hurt(bond) : undefined;
      if (grudge) return `Why should I, ${player}?${sore ? ` Last time, ${toYou(sore.text, player)}.` : ""}`;
      return answerLine(decision, invite, player, decision === "accept" ? SPOT_NAME[ACTIVITY.get(invite.act)!.place] ?? "" : "");
    } finally {
      m.thinking = "";
    }
  }

  // The activity this NPC promised for right now, if any.
  private dueAct(npc: string): string | null {
    const m = this.hub.minds.get(npc);
    if (!m) return null;
    const g = gameTime(this.v.t);
    return dueNow(m.mem.promises, g.day, g.phase)[0]?.act ?? null;
  }

  private settlePromise(npc: Npc, m: Mind, c: Commitment, state: "kept" | "broken"): void {
    m.mem.promises = settle(m.mem.promises, c.id, state);
    const g = gameTime(this.v.t);
    const text = outcomeMemory(c, state);
    remember(m.mem, g.day, clockLabel(g.hour), text, 8);
    addFact(m.mem, text);
    feel(m.mem, m.persona, c.from, state, g.day, text);
    addBelief(m.mem, { about: c.from, text: state === "kept" ? "keeps promises" : "broke a promise", source: "", conf: 0.9, day: g.day });
    bump(this.v.rel, npc, c.from, outcomeAffinity(m.persona, state));
    m.mem.why = `${text} > ${state === "kept" ? "trust" : "trust less"} ${c.from}`;
    this.out.line({ who: npc, mem: promiseLine({ ...c, state }) });
  }

  // Promises at work: leave for it when it is due, and end it by who actually showed up.
  private keepPromises(): void {
    const g = gameTime(this.v.t);
    for (const npc of NPCS) {
      const m = this.hub.minds.get(npc);
      const a = this.v.agents.find((x) => x.id === npc);
      if (!m || !a || !this.hosting(npc)) continue;
      for (const c of missed(m.mem.promises, g.day, g.phase)) {
        // Only someone who was there can be stood up; a place that went missing is nobody's fault.
        if (!this.arrived.has(c.id)) {
          m.mem.promises = settle(m.mem.promises, c.id, "cancelled");
          this.out.line({ who: npc, mem: promiseLine({ ...c, state: "cancelled" }) });
          continue;
        }
        this.settlePromise(npc, m, c, "broken");
        this.said(npc, `${c.from} never came...`);
      }
      for (const c of dueNow(m.mem.promises, g.day, g.phase)) {
        if (!this.leaving.has(c.id)) {
          this.leaving.add(c.id);
          this.said(npc, `Time to go, I promised ${c.from}!`);
          this.out.think?.(npc, `${c.from} is counting on me.`);
        }
        const there = a.act === c.act && (a.state === "wait" || a.state === "do");
        if (there) this.arrived.add(c.id);
        const guest = there && this.people().find((p) => (p.id === c.fromId || p.name === c.from) && Math.hypot(p.pos.x - a.pos.x, p.pos.z - a.pos.z) < PROMISE_DIST);
        if (!guest) continue;
        // The player counts as company, so the activity starts without waiting for another villager.
        const party = this.v.gatherings.find((x) => x.id === a.gather);
        if (party) party.started = true;
        a.state = "do";
        this.settlePromise(npc, m, c, "kept");
        this.said(npc, /birthday/.test(c.occasion) ? `Happy birthday, ${c.from}!${this.present(npc, c)}` : `Glad you came, ${c.from}!`);
      }
    }
  }

  // A birthday guest comes with something from its own stock, if it has anything and the player is on this screen.
  private present(npc: Npc, c: Commitment): string {
    const purse = this.purseOf(npc);
    const good = (Object.keys(purse.goods) as Good[])[0];
    if (!good || !this.pocket || (c.fromId !== "me" && c.fromId !== this.myId)) return "";
    addGood(purse, good, -1);
    this.pocket.change(0, good, 1);
    return ` I brought you ${good}.`;
  }

  // Initiative: the villager comes to you. It asks for what it is after today if it knows you have some, or asks
  // you along to what it likes. Either one waits for your yes. Only a person on good terms gets asked.
  private pitch(npc: Npc, guest: Person): boolean {
    const m = this.hub.minds.get(npc);
    if (!m || this.env.rng() < PITCH_SKIP || (guest.id !== "me" && guest.id !== this.myId)) return false;
    const b = bondOf(m.mem, guest.name);
    if (b && (b.fondness < 0 || holdsGrudge(b))) return false;
    const g = gameTime(this.v.t);
    openDay(this.market, g.day, VILLAGERS);
    const want = wantOf(m.persona, g.day);
    const purse = this.purseOf(npc);
    if (want && this.pocket?.count(want) && purse.coins >= priceOf(this.market, want) && this.market.wanted[want]?.includes(m.persona.name)) {
      const price = priceOf(this.market, want);
      this.offers.set(`${npc}:${guest.name}`, { o: { kind: "sell", good: want, qty: 1, price }, price });
      m.mem.why = `want ${want} today > ${guest.name} has some > offered ${price}c`;
      this.said(npc, `${guest.name}, I am after ${want} today. ${price} coins for one?`, guest.name);
      return true;
    }
    const goal = goalOf(npc, purse);
    const stock = (Object.keys(purse.goods) as Good[]).find((s) => priceOf(this.market, s) <= (this.pocket?.coins() ?? 0));
    if (goal && stock && this.env.rng() < PITCH_SELL) {
      const price = priceOf(this.market, stock);
      this.offers.set(`${npc}:${guest.name}`, { o: { kind: "buy", good: stock, qty: 1, price }, price });
      m.mem.why = `saving for ${goal.what} > have ${stock} to sell > offered it to ${guest.name}`;
      this.said(npc, `${guest.name}, I am saving for ${goal.what}. ${price} coins for my ${stock}?`, guest.name);
      return true;
    }
    const act = PITCH_ACTS.find((a) => traitBias(m.persona, a) > 0 && this.env.spots[ACTIVITY.get(a)!.place]?.length);
    if (!act || g.phase === "evening" || g.phase === "night" || dueNow(m.mem.promises, g.day, "evening").length) return false;
    this.asked.set(`${npc}:${guest.name}`, { act, occasion: "", day: g.day, phase: "evening" });
    m.mem.why = `feel like ${act} > ${guest.name} is around > asked them along`;
    this.said(npc, `${guest.name}, ${act} this evening? Say yes if you are in.`, guest.name);
    return true;
  }

  // The player said yes to what the villager asked: now it is a promise like any other.
  private tookUp(npc: Npc, m: Mind, player: string, playerId: string, line: string): string | null {
    const key = `${npc}:${player}`;
    const invite = this.asked.get(key);
    this.asked.delete(key);
    if (!invite || !YES.test(line)) return null;
    const c: Commitment = { ...invite, id: `${npc}${this.v.nextId++}`, from: player, fromId: playerId, state: "open", importance: 5 };
    m.mem.promises = addCommitment(m.mem.promises, c);
    this.out.line({ who: npc, mem: promiseLine(c) });
    const g = gameTime(this.v.t);
    remember(m.mem, g.day, clockLabel(g.hour), `${player} agreed to ${invite.act} with me this evening`, 6);
    return answerLine("accept", invite, player, SPOT_NAME[ACTIVITY.get(invite.act)!.place] ?? "");
  }

  // The first meeting after a broken promise: the NPC says so to their face, once for each grudge.
  private bringUp(npc: Npc, guest: Person): boolean {
    const m = this.hub.minds.get(npc);
    const r = m && bondOf(m.mem, guest.name)?.why.filter((x) => x.beat === "broken" || x.beat === "gossip").at(-1);
    const key = `${npc}:${r?.text}`;
    if (!r || this.raised.has(key)) return false;
    this.raised.add(key);
    this.said(npc, `${guest.name}, ${toYou(r.text, guest.name)}.${r.beat === "gossip" ? " Is that true?" : ""}`, guest.name);
    return true;
  }

  // Saved enough: it buys the thing, and the next goal starts. The goal also sits in its facts, so its talk knows it.
  private pursueGoals(): void {
    const g = gameTime(this.v.t);
    for (const [id, m] of this.hub.minds) {
      const purse = m.mem.purse;
      if (!purse || !this.hosting(id as Npc)) continue;
      const goal = goalOf(id, purse);
      if (reached(goal, purse)) {
        purse.coins -= goal!.cost;
        purse.goals = (purse.goals ?? 0) + 1;
        const text = `saved up and bought ${goal!.what}`;
        remember(m.mem, g.day, clockLabel(g.hour), text, 8);
        addFact(m.mem, text);
        m.mem.why = `${goal!.cost} coins saved > ${text}`;
        this.said(id as Npc, `At last! I bought ${goal!.what}!`);
      } else if (goal) addFact(m.mem, `saving up for ${goal.what}`);
      if (id === "pip" && (purse.goals ?? 0) >= 1) this.hasPet.pip = true;
    }
  }

  private said(npc: Npc, text: string, to?: string): void {
    this.out.say(npc, text, to);
    if (text !== "..." && this.hosting(npc)) this.out.line({ who: npc, say: text });
  }

  // `t` = the sim clock to follow (the pets' clock, so day and night match on this screen).
  step(dt: number, t: number): LifeEvent[] {
    this.v.t = t - dt;
    const ev = stepVillage(this.v, dt, this.env);
    this.hub.onEvents(ev);
    this.hub.tick();
    this.keepPromises();
    this.pursueGoals();
    this.social();
    for (const e of ev) if (e.kind === "start" && this.hosting(e.who as Npc)) this.out.line({ who: e.who, act: e.act });
    for (const e of ev) if (e.kind === "start" || e.kind === "done") this.earn(e);
    // New memories of the NPCs I host go to the room, so the next host remembers them.
    for (const [id, m] of this.hub.minds) {
      const last = this.sent.get(id) ?? null;
      const from = last ? m.mem.log.indexOf(last) + 1 : 0;
      for (const e of m.mem.log.slice(from)) this.out.line({ who: id, mem: `${e.time || clockLabel(gameTime(this.v.t).hour)} ${e.text}` });
      this.sent.set(id, m.mem.log.at(-1) ?? null);
      const held = m.mem.purse && purseLine(m.mem.purse);
      if (held && this.purses.get(id) !== held) {
        this.purses.set(id, held);
        this.out.line({ who: id, mem: held });
      }
      const wired = this.wired.get(id) ?? new Set<string>();
      this.wired.set(id, wired);
      for (const l of [...Object.entries(m.mem.bonds).map(([who, b]) => bondLine(who, b)), ...m.mem.beliefs.map(beliefLine)]) {
        if (wired.has(l)) continue;
        wired.add(l);
        this.out.line({ who: id, mem: l });
      }
    }
    return ev;
  }
}
