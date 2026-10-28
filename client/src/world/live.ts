import { parseGenes } from "../game/genes";
import { parseFighter, type Fighter } from "../sim/duel";
import type { Genes } from "../sim/ghost";
import type { Memo } from "../sim/memo";

// Live layer v0: one WebSocket to the world room (Worker Durable Object). Other online players' avatars
// and pets walk around in our world; when the room is unreachable or full the world just keeps its
// ghosts. Positions go out at <= 10 Hz and only when we actually moved (incoming WS messages are billed).

export const EMOTES = ["wave", "heart", "dance", "laugh"] as const;
export type Emote = (typeof EMOTES)[number];
export const EMOTE_ICON: Record<Emote, string> = { wave: "\u{1F44B}", heart: "❤️", dance: "\u{1F3B5}", laugh: "\u{1F604}" };

export interface LivePeer {
  id: string;
  name: string;
  genes: Genes;
  x: number;
  z: number;
  px: number;
  pz: number;
  corner: number | null;
}

export type LiveStatus = "connecting" | "online" | "offline" | "full";

export interface LiveHandlers {
  welcome(id: string, corner: number | null, peers: LivePeer[]): void;
  join(p: LivePeer): void;
  leave(id: string): void;
  pos(id: string, x: number, z: number, px: number, pz: number): void;
  emote(id: string, e: Emote): void;
  status(s: LiveStatus): void;
  say?(id: string, text: string): void;
  notice?(text: string): void;
  duel?(duel: string, from: string, name: string): void; // someone challenges us
  duelStart?(duel: string, seed: number, a: Fighter, b: Fighter): void;
  duelEnd?(duel: string, reason: "declined" | "gone"): void;
}

export const SAY_MAX = 80;

export interface Me {
  x: number;
  z: number;
  px: number;
  pz: number;
}

interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 40 ? v : null);
const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);

export function parsePeer(v: unknown): LivePeer | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const id = str(o.id, 16), name = str(o.name, 16);
  const x = num(o.x), z = num(o.z), px = num(o.px), pz = num(o.pz);
  if (!id || !name || x === null || z === null || px === null || pz === null) return null;
  const corner = typeof o.corner === "number" && Number.isInteger(o.corner) && o.corner >= 0 && o.corner < 3 ? o.corner : null;
  return { id, name: name.replace(/[^\p{L}\p{N} _'-]+/gu, ""), genes: parseGenes(o.genes) ?? { hue: 0.6 }, x, z, px, pz, corner };
}

// Validates a server message and calls the matching handler. Unknown or malformed messages are ignored.
export function dispatch(raw: unknown, h: LiveHandlers): void {
  let m: Record<string, unknown>;
  try {
    m = typeof raw === "string" ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return;
  }
  if (!m || typeof m !== "object") return;
  switch (m.t) {
    case "welcome": {
      const id = str(m.id, 16);
      if (!id || !Array.isArray(m.peers)) return;
      const corner = typeof m.corner === "number" ? m.corner : null;
      return h.welcome(id, corner, m.peers.map(parsePeer).filter((p): p is LivePeer => !!p).slice(0, 32));
    }
    case "join": {
      const p = parsePeer(m.peer);
      return p ? h.join(p) : undefined;
    }
    case "leave": {
      const id = str(m.id, 16);
      return id ? h.leave(id) : undefined;
    }
    case "pos": {
      const id = str(m.id, 16), x = num(m.x), z = num(m.z), px = num(m.px), pz = num(m.pz);
      return id && x !== null && z !== null && px !== null && pz !== null ? h.pos(id, x, z, px, pz) : undefined;
    }
    case "emote": {
      const id = str(m.id, 16);
      return id && (EMOTES as readonly unknown[]).includes(m.e) ? h.emote(id, m.e as Emote) : undefined;
    }
    case "full":
      return h.status("full");
    case "say": {
      const id = str(m.id, 16), text = str(m.text, SAY_MAX);
      return id && text ? h.say?.(id, text) : undefined;
    }
    case "notice": {
      const text = str(m.text, 120);
      return text ? h.notice?.(text) : undefined;
    }
    case "duel": {
      const duel = str(m.duel, 16), from = str(m.from, 16), name = str(m.name, 16);
      return duel && from && name ? h.duel?.(duel, from, name) : undefined;
    }
    case "duelStart": {
      const duel = str(m.duel, 16), a = parseFighter(m.a), b = parseFighter(m.b);
      const seed = typeof m.seed === "number" && Number.isInteger(m.seed) && m.seed >= 0 ? m.seed : null;
      return duel && a && b && seed !== null ? h.duelStart?.(duel, seed, a, b) : undefined;
    }
    case "duelEnd": {
      const duel = str(m.duel, 16) ?? "";
      return m.reason === "declined" || m.reason === "gone" ? h.duelEnd?.(duel, m.reason) : undefined;
    }
  }
}

export const SEND_INTERVAL_MS = 100; // <= 10 Hz
const MOVE_EPS = 0.05;
const MAX_RETRIES = 5;

export class LiveLink {
  private ws: SocketLike | null = null;
  private last: Me | null = null;
  private lastSent = 0;
  private retries = 0;
  private stopped = false;
  private full = false;
  private ping: ReturnType<typeof setInterval> | null = null;
  status: LiveStatus = "offline";
  myId: string | null = null; // our id in the room, from the welcome

  constructor(
    private readonly url: string,
    private readonly hello: () => { name: string; genes: Genes } & Me,
    private readonly h: LiveHandlers,
    private readonly open: (url: string) => SocketLike = (u) => new WebSocket(u) as unknown as SocketLike,
  ) {}

  connect() {
    if (this.stopped || this.full) return;
    this.set("connecting");
    let ws: SocketLike;
    try {
      ws = this.open(this.url);
    } catch {
      return this.retry();
    }
    this.ws = ws;
    ws.onopen = () => {
      this.retries = 0;
      const hi = this.hello();
      ws.send(JSON.stringify({ t: "hello", ...hi }));
      this.last = { x: hi.x, z: hi.z, px: hi.px, pz: hi.pz };
      this.set("online");
      this.ping = setInterval(() => ws.readyState === 1 && ws.send("ping"), 30_000);
    };
    ws.onmessage = (ev) => {
      if (ev.data === "pong") return;
      dispatch(ev.data, {
        ...this.h,
        welcome: (id, corner, peers) => {
          this.myId = id;
          this.h.welcome(id, corner, peers);
        },
        status: (s) => {
          if (s === "full") this.full = true;
          this.set(s);
        },
      });
    };
    ws.onclose = () => {
      if (this.ping) clearInterval(this.ping);
      this.ping = null;
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.full) return;
      this.set("offline");
      this.retry();
    };
    ws.onerror = () => {
      /* onclose follows */
    };
  }

  private retry() {
    if (this.stopped || this.retries >= MAX_RETRIES) return this.set("offline");
    const delay = 2000 * 2 ** this.retries++;
    setTimeout(() => this.connect(), delay);
  }

  private set(s: LiveStatus) {
    if (this.status === s) return;
    this.status = s;
    this.h.status(s);
  }

  // Call every frame; sends a position only when we moved and at most every 100 ms.
  tick(now: number, me: Me): boolean {
    const ws = this.ws;
    if (!ws || ws.readyState !== 1 || this.status !== "online") return false;
    if (now - this.lastSent < SEND_INTERVAL_MS) return false;
    const l = this.last;
    if (l && Math.abs(l.x - me.x) < MOVE_EPS && Math.abs(l.z - me.z) < MOVE_EPS && Math.abs(l.px - me.px) < MOVE_EPS && Math.abs(l.pz - me.pz) < MOVE_EPS) {
      return false;
    }
    const r = (v: number) => Math.round(v * 100) / 100;
    ws.send(JSON.stringify({ t: "pos", x: r(me.x), z: r(me.z), px: r(me.px), pz: r(me.pz) }));
    this.last = { ...me };
    this.lastSent = now;
    return true;
  }

  emote(e: Emote): boolean {
    return this.send({ t: "emote", e });
  }

  say(text: string): boolean {
    const t = text.replace(/\s+/g, " ").trim().slice(0, SAY_MAX);
    return t ? this.send({ t: "say", text: t }) : false;
  }

  // Duels carry the memo rules only (no summary or notes) and the genes.
  challenge(to: string, memo: Memo, genes: Genes): boolean {
    return this.send({ t: "duel", to, memo: rulesOnly(memo), genes });
  }

  accept(duel: string, memo: Memo, genes: Genes): boolean {
    return this.send({ t: "duelAccept", duel, memo: rulesOnly(memo), genes });
  }

  decline(duel: string): boolean {
    return this.send({ t: "duelDecline", duel });
  }

  private send(m: object): boolean {
    if (!this.ws || this.ws.readyState !== 1 || this.status !== "online") return false;
    this.ws.send(JSON.stringify(m));
    return true;
  }

  close() {
    this.stopped = true;
    const ws = this.ws;
    this.ws = null;
    ws?.close();
    this.set("offline");
  }
}

const rulesOnly = (m: Memo) => ({ summary: "", rules: m.rules.map((r) => ({ if: r.if, do: r.do, why: "" })) });

export const roomUrl = (loc: { protocol: string; host: string }): string => `${loc.protocol === "https:" ? "wss" : "ws"}://${loc.host}/api/room`;

// A friendly display name derived from the pet's genes (no account, no personal data).
const NAMES = ["Mochi", "Pip", "Tofu", "Maple", "Biscuit", "Nori", "Pebble", "Dumpling", "Clover", "Bean", "Puff", "Sunny"];
const TITLES = ["Sleepy", "Brave", "Tiny", "Fluffy", "Lucky", "Cozy", "Bouncy", "Gentle"];
export function liveName(g: Genes): string {
  const at = (v: number | undefined, n: number) => Math.min(n - 1, Math.floor((typeof v === "number" ? v : 0.5) * n));
  return `${TITLES[at(g.accent, TITLES.length)]} ${NAMES[at(g.hue, NAMES.length)]}`;
}
