import { parseGhostMemo, type GhostMemo } from "./memo-dsl";

// Live room logic (pure, no Workers APIs, so it is unit-tested directly). One room per world: players
// who are online see each other's avatar + pet walk around, wave with emotes, and the first three get a
// corner. The Durable Object in room-do.ts owns the sockets; this file validates every message, rate-limits
// each socket and says who gets what.
//
// Duels: A challenges B (A's memo + genes ride along), B accepts with its own; the room picks the seed and
// sends both snapshots to both players, whose clients run the same deterministic sim, so they see the same
// fight. Room chat: short lines, links refused, a few bad words masked, one line per 1.5 s.
//
// Billing note (Cloudflare free plan): incoming WebSocket messages count 20:1 as requests, so clients send
// positions at <= 10 Hz and only while moving; the server drops anything faster.

export const ROOM_MAX_PEERS = 24;
export const ROOM_MAX_MSG_BYTES = 4096; // a duel carries a memo (<= 8 rules); positions are ~60 bytes
export const SAY_MAX = 80;
export const SAY_GAP_MS = 1500;
export const DUEL_TTL_MS = 30_000;
const DUEL_COST = 4; // extra tokens per challenge, so nobody spams invites
export const CORNERS = 3;
export const EMOTES = ["wave", "heart", "dance", "laugh"] as const;
export type Emote = (typeof EMOTES)[number];
const WORLD_LIMIT = 40; // |x|, |z| bound of the island grid, with margin
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
  tokens: number;
  at: number; // last token refill, ms
  strikes: number;
  duel?: { id: string; to: string; memo: GhostMemo; genes: Record<string, number>; at: number }; // outgoing challenge
  sayAt?: number; // last chat line, ms
}

export type PublicPeer = Pick<Peer, "id" | "name" | "genes" | "x" | "z" | "px" | "pz" | "corner">;

export type ServerMsg =
  | { t: "welcome"; id: string; corner: number | null; peers: PublicPeer[] }
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

export const publicPeer = (p: Peer): PublicPeer => ({ id: p.id, name: p.name, genes: p.genes, x: p.x, z: p.z, px: p.px, pz: p.pz, corner: p.corner });

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
  private readonly dirty = new Set<string>(); // peers changed as a side effect (persist their attachment)

  constructor(private readonly random: () => number = Math.random) {}

  takeDirty(): string[] {
    const d = [...this.dirty];
    this.dirty.clear();
    return d;
  }

  // Rebuild after the Durable Object wakes from hibernation (state lives in each socket's attachment).
  restore(p: Peer) {
    this.peers.set(p.id, p);
  }

  private freeCorner(): number | null {
    const used = new Set([...this.peers.values()].map((p) => p.corner));
    for (let c = 0; c < CORNERS; c++) if (!used.has(c)) return c;
    return null;
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
      corner: this.freeCorner(),
      tokens: BURST,
      at: now,
      strikes: 0,
    };
    const others = [...this.peers.values()].map(publicPeer);
    this.peers.set(id, peer);
    return {
      peer,
      out: [
        { to: "self", msg: { t: "welcome", id, corner: peer.corner, peers: others } },
        { to: "others", msg: { t: "join", peer: publicPeer(peer) } },
      ],
    };
  }

  leave(id: string): Out[] {
    const me = this.peers.get(id);
    if (!me) return [];
    this.peers.delete(id);
    const out: Out[] = [{ to: "others", msg: { t: "leave", id } }];
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
      return { out: [{ to: "others", msg: { t: "say", id, text } }], changed: true };
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
