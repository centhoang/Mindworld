// Live room logic (pure, no Workers APIs, so it is unit-tested directly). One room per world: players
// who are online see each other's avatar + pet walk around, wave with emotes, and the first three get a
// corner. The Durable Object in room-do.ts owns the sockets; this file validates every message, rate-limits
// each socket and says who gets what.
//
// Billing note (Cloudflare free plan): incoming WebSocket messages count 20:1 as requests, so clients send
// positions at <= 10 Hz and only while moving; the server drops anything faster.

export const ROOM_MAX_PEERS = 24;
export const ROOM_MAX_MSG_BYTES = 512;
export const CORNERS = 3;
export const EMOTES = ["wave", "heart", "dance", "laugh"] as const;
export type Emote = (typeof EMOTES)[number];
const WORLD_LIMIT = 40; // |x|, |z| bound of the island grid, with margin
const RATE_PER_S = 12; // token bucket refill (positions are <= 10 Hz plus the odd emote)
const BURST = 20;
const MAX_STRIKES = 60; // dropped messages before the socket is closed
const MAX_GENES = 12;

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
}

export type PublicPeer = Pick<Peer, "id" | "name" | "genes" | "x" | "z" | "px" | "pz" | "corner">;

export type ServerMsg =
  | { t: "welcome"; id: string; corner: number | null; peers: PublicPeer[] }
  | { t: "join"; peer: PublicPeer }
  | { t: "leave"; id: string }
  | { t: "pos"; id: string; x: number; z: number; px: number; pz: number }
  | { t: "emote"; id: string; e: Emote }
  | { t: "full" };

export interface Out {
  to: "others" | "self";
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
    return this.peers.delete(id) ? [{ to: "others", msg: { t: "leave", id } }] : [];
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
    return this.strike(peer);
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
