import { cleanScene } from "./chat";
import { parseGhostMemo, type GhostMemo } from "./memo-dsl";
import { cleanCap, cleanMem, isNpc, MIND_ACTS, NpcBoard, type Cap, type HostChange, type Npc } from "./npc";

// Live room logic (pure, no Workers APIs, so it is unit-tested directly). One room per world: players
// who are online see each other's avatar + pet walk around and wave with emotes. Each player gets a slot
// for their ground (the client draws it from the seed in their hello); when they leave, the ground stays
// as a ghost ground for AWAY_MS (the same seed coming back takes its slot again), then the slot frees. The Durable Object in room-do.ts owns the sockets; this file validates every message, rate-limits
// each socket and says who gets what.
//
// Duels: A challenges B (A's memo + genes ride along), B accepts with its own; the room picks the seed and
// sends both snapshots to both players, whose clients run the same deterministic sim, so they see the same
// fight. Room chat: short lines, links refused, a few bad words masked, one line per 1.5 s.
//
// Minds: each player's pets and the NPC each player hosts (npc.ts) speak through `mind` lines: an activity,
// a short line, an emote, an invitation. Only the owner speaks for a pet, only the current host for an NPC;
// one line per mind per 3 s (a line may name who it is `to`: a player's live id or an NPC). Hosts send `cap`
// (model speed, <= 1 / 10 s) as their heartbeat. A player's question to an NPC hosted elsewhere is relayed to
// that host (`ask`) when its machine has a local model; else the asker hears `askNo` at once (cloud answer).
//
// Privacy: a line said to a player goes to that player only, enforced here, not just hidden on screen. Other mind
// lines reach players within HEAR_DIST of the speaker (and the host of an NPC being spoken to, so its mind can
// answer). Plain room chat stays public. `talk` marks a private chat: both sides are busy, others see that they are
// talking and can't start a chat with them. It ends on close, on disconnect, or after TALK_TTL_MS of silence.
//
// Billing note (Cloudflare free plan): incoming WebSocket messages count 20:1 as requests, so clients send
// positions at <= 10 Hz and only while moving; the server drops anything faster.

export const ROOM_MAX_PEERS = 24;
export const ROOM_MAX_MSG_BYTES = 4096; // a duel carries a memo (<= 8 rules); positions are ~60 bytes
export const SAY_MAX = 80;
export const SAY_GAP_MS = 1500;
export const DUEL_TTL_MS = 30_000;
const DUEL_COST = 4; // extra tokens per challenge, so nobody spams invites
export const CORNERS = 24; // ground slots on the ring around the hub (client: world/layout SLOTS)
export const AWAY_MS = 10 * 60_000;
export const EMOTES = ["wave", "heart", "dance", "laugh"] as const;
export const MIND_SAY_GAP_MS = 3000;
export const ASK_GAP_MS = 3000;
export const HEAR_DIST = 14; // tiles: how far a public mind line carries
export const TALK_TTL_MS = 45_000; // clients renew an open chat every 15 s
const CAP_GAP_MS = 9000;
export type Emote = (typeof EMOTES)[number];
const WORLD_LIMIT = 160; // |x|, |z| bound of the ground ring, with margin
const RATE_PER_S = 12; // token bucket refill (positions are <= 10 Hz plus the odd emote)
const BURST = 20;
const MAX_STRIKES = 60; // dropped messages before the socket is closed
const MAX_GENES = 12;

export interface Fighter {
  id: string;
  name: string;
  genes: Record<string, number>;
  memo: GhostMemo;
}

const BAD_WORDS = ["fuck", "shit", "bitch", "cunt", "dick", "pussy", "asshole", "bastard", "slut", "whore", "nigger", "nigga", "faggot", "retard", "kys"];
const LINKISH = /(https?:|www\.|\b[a-z0-9-]+\.(com|net|org|io|gg|ly|xyz|me|co|tv|app|dev|ru|cn)\b|discord\.gg|@[a-z0-9_]{3,})/i;

// Duels share the rules only: summary and "why" notes are free text and stay on the owner's device.
const rulesOnly = (v: unknown): GhostMemo | null => {
  const m = parseGhostMemo(v);
  return m ? { summary: "", rules: m.rules.map((r) => ({ ...r, why: "" })) } : null;
};

// One chat line: cleaned, capped, links refused (null), bad words masked.
export function cleanSay(v: unknown): string | null {
  if (typeof v !== "string") return null;
  let t = v.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, SAY_MAX);
  if (!t || LINKISH.test(t)) return null;
  for (const w of BAD_WORDS) t = t.replace(new RegExp(w.split("").join("[^a-z]?"), "gi"), (m) => "*".repeat(m.length));
  return t;
}

export interface Peer {
  id: string;
  name: string;
  genes: Record<string, number>;
  x: number;
  z: number;
  px: number; // pet position
  pz: number;
  corner: number | null;
  seed: number; // ground seed: the client draws this player's ground from it
  tokens: number;
  at: number; // last token refill, ms
  strikes: number;
  duel?: { id: string; to: string; memo: GhostMemo; genes: Record<string, number>; at: number }; // outgoing challenge
  sayAt?: number; // last chat line, ms
  askAt?: number; // last question to an NPC, ms
  cap: Cap; // local model speed: picks NPC hosts
  capAt?: number; // last cap message, ms
}

export type PublicPeer = Pick<Peer, "id" | "name" | "genes" | "x" | "z" | "px" | "pz" | "corner" | "seed">;

// A ground whose owner left: kept on its slot until `until` (ms).
export interface Away {
  slot: number;
  name: string;
  seed: number;
  until: number;
}
export type PublicAway = Omit<Away, "until"> & { ttl: number }; // ms left (clients' clocks differ)

export type ServerMsg =
  | { t: "welcome"; id: string; corner: number | null; peers: PublicPeer[]; aways: PublicAway[]; npcs: Partial<Record<Npc, string>>; talks: [string, string][] }
  | { t: "talking"; id: string; with: string; on: boolean }
  | { t: "talkNo"; with: string }
  | { t: "npcHost"; npc: Npc; host: string | null }
  | { t: "npcState"; npc: Npc; log: string[] }
  | { t: "mind"; id: string; who: string; act?: string; say?: string; to?: string; emote?: Emote; invite?: { act: string; to?: string }; trade?: string }
  | { t: "ask"; npc: Npc; from: string; name: string; text: string; scene?: string }
  | { t: "askNo"; npc: Npc }
  | { t: "away"; away: PublicAway }
  | { t: "join"; peer: PublicPeer }
  | { t: "leave"; id: string }
  | { t: "pos"; id: string; x: number; z: number; px: number; pz: number }
  | { t: "emote"; id: string; e: Emote }
  | { t: "full" }
  | { t: "say"; id: string; text: string }
  | { t: "notice"; text: string }
  | { t: "duel"; duel: string; from: string; name: string }
  | { t: "duelStart"; duel: string; seed: number; a: Fighter; b: Fighter }
  | { t: "duelEnd"; duel: string; reason: "declined" | "gone" };

export interface Out {
  to: "others" | "self" | { id: string };
  msg: ServerMsg;
}

export interface MessageResult {
  out: Out[];
  close?: string; // reason: the socket should be closed
  changed?: boolean; // the peer's state changed (persist it)
}

export const publicPeer = (p: Peer): PublicPeer => ({ id: p.id, name: p.name, genes: p.genes, x: p.x, z: p.z, px: p.px, pz: p.pz, corner: p.corner, seed: p.seed });
const publicAway = (a: Away, now: number): PublicAway => ({ slot: a.slot, name: a.name, seed: a.seed, ttl: Math.max(0, a.until - now) });
export const cleanSeed = (v: unknown): number => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 2 ** 31 ? v : 0);

export function cleanName(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/[^\p{L}\p{N} _'-]+/gu, "").replace(/\s+/g, " ").trim().slice(0, 16);
}

export function cleanGenes(v: unknown): Record<string, number> {
  const g: Record<string, number> = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return g;
  for (const [k, n] of Object.entries(v as Record<string, unknown>).slice(0, MAX_GENES)) {
    if (/^[a-z][a-zA-Z0-9]{0,15}$/.test(k) && typeof n === "number" && Number.isFinite(n)) g[k] = Math.min(1, Math.max(0, n));
  }
  return g;
}

const coord = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= WORLD_LIMIT ? Math.round(v * 100) / 100 : null;

export class Room {
  readonly peers = new Map<string, Peer>();
  readonly board = new NpcBoard();
  private readonly mindSayAt = new Map<string, number>(); // "peer:who" -> last line, ms
  aways: Away[] = []; // ghost grounds (the DO stores them: they outlive every socket)
  awaysChanged = false;
  private readonly dirty = new Set<string>(); // peers changed as a side effect (persist their attachment)
  // peer -> who they opened a private chat with (a peer id or an NPC). Lost on a Durable Object restart, which
  // only means the talking bubbles stop until the next `talk` renewal.
  private readonly talks = new Map<string, { with: string; at: number }>();

  constructor(private readonly random: () => number = Math.random) {}

  takeDirty(): string[] {
    const d = [...this.dirty];
    this.dirty.clear();
    return d;
  }

  // Rebuild after the Durable Object wakes from hibernation (state lives in each socket's attachment).
  restore(p: Peer) {
    p.cap ??= { webgpu: false, tps: 0 }; // attachments from before minds
    this.peers.set(p.id, p);
  }

  private busy(who: string): boolean {
    if (this.talks.has(who)) return true;
    for (const t of this.talks.values()) if (t.with === who) return true;
    return false;
  }

  // Tells every player, the two in the chat included.
  private talkOuts(id: string, withWho: string, on: boolean): Out[] {
    const msg: ServerMsg = { t: "talking", id, with: withWho, on };
    return [...this.peers.keys()].map((p) => ({ to: { id: p }, msg }));
  }

  // Ends the chats `who` is in, on either side.
  private endTalks(who: string): Out[] {
    const out: Out[] = [];
    for (const [id, t] of this.talks) {
      if (id !== who && t.with !== who) continue;
      this.talks.delete(id);
      out.push(...this.talkOuts(id, t.with, false));
    }
    return out;
  }

  // No timers in the room: every message is a chance to end a chat that went quiet.
  private expireTalks(now: number): Out[] {
    const out: Out[] = [];
    for (const [id, t] of this.talks) {
      if (now - t.at <= TALK_TTL_MS) continue;
      this.talks.delete(id);
      out.push(...this.talkOuts(id, t.with, false));
    }
    return out;
  }

  private talk(peer: Peer, o: Record<string, unknown>, now: number): MessageResult {
    if (o.with === undefined) return { out: this.endTalks(peer.id), changed: true };
    const to = typeof o.with === "string" && (isNpc(o.with) || this.peers.has(o.with)) && o.with !== peer.id ? o.with : null;
    if (!to) return this.strike(peer);
    const mine = this.talks.get(peer.id);
    if (mine?.with === to) {
      mine.at = now;
      return { out: [] };
    }
    const partner = this.talks.get(to);
    if (partner?.with === peer.id) {
      partner.at = now;
      return { out: [] };
    }
    if (this.busy(to) || this.busy(peer.id)) return { out: [{ to: "self", msg: { t: "talkNo", with: to } }] };
    this.talks.set(peer.id, { with: to, at: now });
    return { out: this.talkOuts(peer.id, to, true), changed: true };
  }

  // Who hosts which NPC, told to everyone (skipSelf: the sender already knows, e.g. from its welcome); the
  // new host also gets the NPC's memory log.
  private hostOuts(changes: HostChange[], skipSelf: boolean): Out[] {
    const out: Out[] = [];
    for (const c of changes) {
      const msg: ServerMsg = { t: "npcHost", npc: c.npc, host: c.host };
      out.push({ to: "others", msg });
      if (!skipSelf) out.push({ to: "self", msg });
      if (c.host) out.push({ to: { id: c.host }, msg: { t: "npcState", npc: c.npc, log: this.board.log(c.npc) } });
    }
    return out;
  }

  restoreAways(list: unknown): void {
    if (!Array.isArray(list)) return;
    this.aways = list
      .filter((a): a is Away => !!a && typeof a === "object" && Number.isInteger(a.slot) && a.slot >= 0 && a.slot < CORNERS && typeof a.until === "number")
      .map((a) => ({ slot: a.slot, name: cleanName(a.name) || "Visitor", seed: cleanSeed(a.seed), until: a.until }));
  }

  private setAways(next: Away[]): void {
    if (next.length !== this.aways.length || next.some((a, i) => a !== this.aways[i])) this.awaysChanged = true;
    this.aways = next;
  }

  // A slot for a new player: their own ghost ground first (same seed, back within AWAY_MS), else the first
  // slot nobody holds, else the ghost ground closest to expiring.
  private takeSlot(seed: number, now: number): number | null {
    this.setAways(this.aways.filter((a) => a.until > now));
    const used = new Set([...this.peers.values()].map((p) => p.corner));
    const mine = seed ? this.aways.find((a) => a.seed === seed && !used.has(a.slot)) : undefined;
    const held = new Set([...used, ...this.aways.map((a) => a.slot)]);
    let slot = mine?.slot ?? null;
    for (let c = 0; slot === null && c < CORNERS; c++) if (!held.has(c)) slot = c;
    if (slot === null) slot = [...this.aways].sort((a, b) => a.until - b.until).find((a) => !used.has(a.slot))?.slot ?? null;
    if (slot !== null) this.setAways(this.aways.filter((a) => a.slot !== slot));
    return slot;
  }

  // A new socket says hello. Returns null when the room is full (the DO answers {t:"full"} and closes).
  join(id: string, raw: unknown, now: number): { peer: Peer; out: Out[] } | null {
    if (this.peers.size >= ROOM_MAX_PEERS) return null;
    const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const peer: Peer = {
      id,
      name: cleanName(o.name) || "Visitor",
      genes: cleanGenes(o.genes),
      x: coord(o.x) ?? 0,
      z: coord(o.z) ?? 0.5,
      px: coord(o.px) ?? -1,
      pz: coord(o.pz) ?? 2.5,
      corner: this.takeSlot(cleanSeed(o.groundSeed), now),
      seed: cleanSeed(o.groundSeed),
      tokens: BURST,
      at: now,
      strikes: 0,
      cap: cleanCap(o.cap),
    };
    const others = [...this.peers.values()].map(publicPeer);
    this.peers.set(id, peer);
    const elected = this.board.elect(this.peers, now, true);
    return {
      peer,
      out: [
        { to: "self", msg: { t: "welcome", id, corner: peer.corner, peers: others, aways: this.aways.map((a) => publicAway(a, now)), npcs: this.board.hostsMap(), talks: [...this.talks].map(([a, t]) => [a, t.with]) } },
        { to: "others", msg: { t: "join", peer: publicPeer(peer) } },
        ...this.hostOuts(elected, true),
      ],
    };
  }

  leave(id: string, now = Date.now()): Out[] {
    const me = this.peers.get(id);
    if (!me) return [];
    this.peers.delete(id);
    const out: Out[] = [{ to: "others", msg: { t: "leave", id } }, ...this.endTalks(id)];
    if (me.corner !== null) {
      const away: Away = { slot: me.corner, name: me.name, seed: me.seed, until: now + AWAY_MS };
      this.setAways([...this.aways.filter((a) => a.until > now && a.slot !== me.corner), away]);
      out.push({ to: "others", msg: { t: "away", away: publicAway(away, now) } });
    }
    for (const k of this.mindSayAt.keys()) if (k.startsWith(`${id}:`)) this.mindSayAt.delete(k);
    out.push(...this.hostOuts(this.board.elect(this.peers, now, true), true));
    for (const p of this.peers.values()) {
      if (p.duel?.to === id) {
        out.push({ to: { id: p.id }, msg: { t: "duelEnd", duel: p.duel.id, reason: "gone" } });
        delete p.duel;
        this.dirty.add(p.id);
      }
    }
    if (me.duel) out.push({ to: { id: me.duel.to }, msg: { t: "duelEnd", duel: me.duel.id, reason: "gone" } });
    return out;
  }

  message(id: string, data: string | ArrayBuffer, now: number): MessageResult {
    const r = this.handle(id, data, now);
    // Every message is a chance to notice a host that went quiet (no timers in the room).
    const elected = this.peers.has(id) ? this.board.elect(this.peers, now) : [];
    if (elected.length) r.out = [...this.hostOuts(elected, false), ...r.out];
    const ended = this.expireTalks(now);
    if (ended.length) r.out = [...ended, ...r.out];
    return r;
  }

  private handle(id: string, data: string | ArrayBuffer, now: number): MessageResult {
    const peer = this.peers.get(id);
    if (!peer) return { out: [], close: "unknown" };
    if (!this.take(peer, now)) {
      peer.strikes += 1;
      return peer.strikes > MAX_STRIKES ? { out: [], close: "rate" } : { out: [], changed: true };
    }
    if (typeof data !== "string" || data.length > ROOM_MAX_MSG_BYTES) return this.strike(peer);
    let m: unknown;
    try {
      m = JSON.parse(data);
    } catch {
      return this.strike(peer);
    }
    if (!m || typeof m !== "object") return this.strike(peer);
    const o = m as Record<string, unknown>;
    if (o.t === "pos") {
      const x = coord(o.x), z = coord(o.z), px = coord(o.px), pz = coord(o.pz);
      if (x === null || z === null || px === null || pz === null) return this.strike(peer);
      Object.assign(peer, { x, z, px, pz });
      return { out: [{ to: "others", msg: { t: "pos", id, x, z, px, pz } }], changed: true };
    }
    if (o.t === "emote" && (EMOTES as readonly unknown[]).includes(o.e)) {
      return { out: [{ to: "others", msg: { t: "emote", id, e: o.e as Emote } }], changed: true };
    }
    if (o.t === "say") {
      if (peer.sayAt !== undefined && now - peer.sayAt < SAY_GAP_MS) return { out: [{ to: "self", msg: { t: "notice", text: "Slow down a little." } }], changed: true };
      const text = cleanSay(o.text);
      if (text === null) return { out: [{ to: "self", msg: { t: "notice", text: "Links are not allowed in chat." } }], changed: true };
      peer.sayAt = now;
      if (o.to === undefined) return { out: [{ to: "others", msg: { t: "say", id, text } }], changed: true };
      // A private line needs an open chat between the two; it renews that chat.
      const to = typeof o.to === "string" ? o.to : "";
      const chat = this.talks.get(id)?.with === to ? this.talks.get(id) : this.talks.get(to)?.with === id ? this.talks.get(to) : undefined;
      if (!chat || !this.peers.has(to)) return { out: [{ to: "self", msg: { t: "talkNo", with: to.slice(0, 16) } }], changed: true };
      chat.at = now;
      return { out: [{ to: { id: to }, msg: { t: "say", id, text } }], changed: true };
    }
    if (o.t === "talk") return this.talk(peer, o, now);
    if (o.t === "mind") return this.mind(peer, o, now);
    if (o.t === "ask") {
      const text = cleanSay(o.text);
      if (!isNpc(o.npc) || !text) return this.strike(peer);
      if (peer.askAt !== undefined && now - peer.askAt < ASK_GAP_MS) return { out: [{ to: "self", msg: { t: "askNo", npc: o.npc } }] };
      peer.askAt = now;
      const chat = this.talks.get(id);
      if (chat?.with === o.npc) chat.at = now;
      const host = this.board.hostOf(o.npc);
      const h = host && host !== id ? this.peers.get(host) : undefined;
      if (!h || h.cap.tps <= 0) return { out: [{ to: "self", msg: { t: "askNo", npc: o.npc } }], changed: true };
      const scene = cleanScene((o as { scene?: unknown }).scene); // what the asker and the NPC both see
      return { out: [{ to: { id: h.id }, msg: scene ? { t: "ask", npc: o.npc, from: id, name: peer.name, text, scene } : { t: "ask", npc: o.npc, from: id, name: peer.name, text } }], changed: true };
    }
    if (o.t === "cap") {
      if (peer.capAt !== undefined && now - peer.capAt < CAP_GAP_MS) return { out: [] };
      peer.cap = cleanCap(o);
      peer.capAt = now;
      this.board.beat(peer.id, now);
      return { out: [], changed: true };
    }
    if (o.t === "duel") return this.challenge(peer, o, now);
    if (o.t === "duelAccept") return this.accept(peer, o, now);
    if (o.t === "duelDecline") {
      const c = this.challengerOf(peer.id, o.duel, now);
      if (!c) return { out: [], changed: true };
      const duel = c.duel!.id;
      delete c.duel;
      this.dirty.add(c.id);
      return { out: [{ to: { id: c.id }, msg: { t: "duelEnd", duel, reason: "declined" } }], changed: true };
    }
    return this.strike(peer);
  }

  private mind(peer: Peer, o: Record<string, unknown>, now: number): MessageResult {
    const npc = isNpc(o.who) ? o.who : null;
    const who = npc ?? cleanName(o.who);
    if (!who || (npc && this.board.hostOf(npc) !== peer.id)) return this.strike(peer);
    const isAct = (v: unknown): v is string => (MIND_ACTS as readonly unknown[]).includes(v);
    const msg: Extract<ServerMsg, { t: "mind" }> = { t: "mind", id: peer.id, who };
    if (o.act !== undefined) {
      if (!isAct(o.act)) return this.strike(peer);
      msg.act = o.act;
    }
    if (o.emote !== undefined) {
      if (!(EMOTES as readonly unknown[]).includes(o.emote)) return this.strike(peer);
      msg.emote = o.emote as Emote;
    }
    if (o.invite !== undefined) {
      const inv = o.invite && typeof o.invite === "object" ? (o.invite as Record<string, unknown>) : {};
      if (!isAct(inv.act)) return this.strike(peer);
      const to = cleanName(inv.to);
      msg.invite = to ? { act: inv.act, to } : { act: inv.act };
    }
    if (o.say !== undefined) {
      const k = `${peer.id}:${who}`;
      const last = this.mindSayAt.get(k);
      const text = cleanSay(o.say);
      if (text && (last === undefined || now - last >= MIND_SAY_GAP_MS)) {
        msg.say = text;
        this.mindSayAt.set(k, now);
        const to = typeof o.to === "string" ? o.to.replace(/[^\w-]/g, "").slice(0, 24) : "";
        if (to) msg.to = to;
      }
    }
    if (o.mem !== undefined) {
      if (!npc) return this.strike(peer);
      const line = cleanMem(o.mem);
      if (line?.startsWith("trade|")) msg.trade = line; // the town board is public
      else if (line) this.board.remember(npc, line);
    }
    if (npc) this.board.beat(peer.id, now);
    const { say, to, ...rest } = msg;
    const others = rest.act || rest.emote || rest.invite || rest.trade ? rest : null; // what travels without the spoken line
    if (!say) return { out: others ? [{ to: "others", msg: others }] : [], changed: true };
    return { out: this.hearers(peer, msg, others, o), changed: true };
  }

  // A spoken line by who it is for: the player it is said to, or everyone close to the speaker plus the host of the
  // NPC spoken to. The rest get what is left of the message, if anything.
  private hearers(peer: Peer, msg: Extract<ServerMsg, { t: "mind" }>, others: ServerMsg | null, o: Record<string, unknown>): Out[] {
    const toPeer = msg.to && this.peers.has(msg.to) ? msg.to : null;
    const x = coord(o.x) ?? peer.x, z = coord(o.z) ?? peer.z;
    const toHost = isNpc(msg.to) ? this.board.hostOf(msg.to) : null;
    const out: Out[] = [];
    for (const p of this.peers.values()) {
      if (p.id === peer.id) continue;
      const hears = toPeer ? p.id === toPeer : p.id === toHost || Math.hypot(p.x - x, p.z - z) <= HEAR_DIST;
      if (hears) out.push({ to: { id: p.id }, msg });
      else if (others) out.push({ to: { id: p.id }, msg: others });
    }
    return out;
  }

  private challenge(peer: Peer, o: Record<string, unknown>, now: number): MessageResult {
    const target = typeof o.to === "string" ? this.peers.get(o.to) : undefined;
    const memo = rulesOnly(o.memo);
    if (!target || target.id === peer.id || !memo) return this.strike(peer);
    if (peer.tokens < DUEL_COST) return { out: [{ to: "self", msg: { t: "notice", text: "Wait a moment before challenging again." } }], changed: true };
    peer.tokens -= DUEL_COST;
    const duel = Math.floor(this.random() * 2 ** 32).toString(36);
    peer.duel = { id: duel, to: target.id, memo, genes: cleanGenes(o.genes), at: now };
    return { out: [{ to: { id: target.id }, msg: { t: "duel", duel, from: peer.id, name: peer.name } }], changed: true };
  }

  private challengerOf(me: string, duel: unknown, now: number): Peer | null {
    if (typeof duel !== "string") return null;
    for (const p of this.peers.values()) if (p.duel?.id === duel && p.duel.to === me && now - p.duel.at <= DUEL_TTL_MS) return p;
    return null;
  }

  private accept(peer: Peer, o: Record<string, unknown>, now: number): MessageResult {
    const memo = rulesOnly(o.memo);
    if (!memo) return this.strike(peer);
    const c = this.challengerOf(peer.id, o.duel, now);
    if (!c) return { out: [{ to: "self", msg: { t: "duelEnd", duel: typeof o.duel === "string" ? o.duel.slice(0, 16) : "", reason: "gone" } }], changed: true };
    const d = c.duel!;
    delete c.duel;
    delete peer.duel; // one duel per pet: the accepter's own open challenge is withdrawn
    this.dirty.add(c.id);
    const msg: ServerMsg = {
      t: "duelStart",
      duel: d.id,
      seed: Math.floor(this.random() * 1e9),
      a: { id: c.id, name: c.name, genes: d.genes, memo: d.memo },
      b: { id: peer.id, name: peer.name, genes: cleanGenes(o.genes), memo },
    };
    return { out: [{ to: "self", msg }, { to: { id: c.id }, msg }], changed: true };
  }

  private strike(peer: Peer): MessageResult {
    peer.strikes += 1;
    return peer.strikes > MAX_STRIKES ? { out: [], close: "invalid" } : { out: [], changed: true };
  }

  private take(peer: Peer, now: number): boolean {
    peer.tokens = Math.min(BURST, peer.tokens + ((now - peer.at) / 1000) * RATE_PER_S);
    peer.at = now;
    if (peer.tokens < 1) return false;
    peer.tokens -= 1;
    return true;
  }
}
