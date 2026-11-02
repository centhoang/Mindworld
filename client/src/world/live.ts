import { parseGenes } from "../game/genes";
import { SLOT_COUNT } from "./layout";
import { cleanScene } from "../mind/scene";
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
  corner: number | null; // ground slot (world/layout SLOTS)
  seed: number; // ground seed (0 = none sent: the client picks one from the id)
}

// A ghost ground: its owner left; it stays on its slot for ttl ms.
export interface LiveAway {
  slot: number;
  name: string;
  seed: number;
  ttl: number;
}

// Village NPCs hosted in players' browsers (worker/src/npc.ts).
export const NPCS = ["elder", "mo", "ama", "pip"] as const;
export type Npc = (typeof NPCS)[number];
export const isNpc = (v: unknown): v is Npc => (NPCS as readonly unknown[]).includes(v);

// A mind's public moment: what it is doing, saying or showing, or who it invites to what.
export interface MindLine {
  who: string; // one of my pets' names, or an NPC I host
  act?: string;
  say?: string;
  to?: string; // who the line is said to: a player's live id (private) or an NPC
  x?: number; // where the speaker stands: public lines carry to players nearby
  z?: number;
  emote?: Emote;
  invite?: { act: string; to?: string };
  trade?: string; // a town board line (economy.ts)
}
export const MIND_SAY_MAX = 80;
const MIND_GAP_MS = 3100; // the room's spoken-line gap per mind (3 s) plus a little slack
const MIND_QUEUE_MS = 12_000;

export type LiveStatus = "connecting" | "online" | "offline" | "full";

export type NpcSpot = [string, number, number, string, string]; // id, x, z, state, activity
export type FarmPlot = [string, number]; // crop ("" = empty), stage

export interface LiveHandlers {
  welcome(id: string, corner: number | null, peers: LivePeer[], aways: LiveAway[], npcs?: Partial<Record<Npc, string>>, talks?: [string, string][]): void;
  talking?(id: string, withWho: string, on: boolean): void; // a private chat started or ended
  talkNo?(withWho: string): void; // they are busy: my chat did not open
  mind?(from: string, line: MindLine): void; // from = the sender's live id
  npcHost?(npc: Npc, host: string | null): void;
  npcState?(npc: Npc, log: string[]): void; // we host it now: its memory so far
  ask?(npc: Npc, from: string, name: string, text: string, scene?: string): void; // a player asks an NPC I host (+ what they both see)
  askNo?(npc: Npc): void; // my question can't reach the NPC's host model: answer it another way
  away?(a: LiveAway): void;
  join(p: LivePeer): void;
  leave(id: string): void;
  pos(id: string, x: number, z: number, px: number, pz: number): void;
  pose(id: string, pose: string | null, flip: boolean): void;
  npcs?(list: NpcSpot[]): void; // where the host of each villager has it
  farm?(id: string, plots: FarmPlot[]): void;
  emote(id: string, e: Emote): void;
  status(s: LiveStatus): void;
  say?(id: string, text: string): void;
  notice?(text: string): void;
  duel?(duel: string, from: string, name: string): void; // someone challenges us
  duelStart?(duel: string, seed: number, a: Fighter, b: Fighter): void;
  duelEnd?(duel: string, reason: "declined" | "gone"): void;
}

export const SAY_MAX = 80;
export const NAME_MAX = 10;

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

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 160 ? v : null);
const slotOf = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < SLOT_COUNT ? v : null);
const seedOf = (v: unknown): number => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 2 ** 31 ? v : 0);
const cleanName = (n: string) => n.replace(/[^\p{L}\p{N} _'-]+/gu, "");

export function parseAway(v: unknown): LiveAway | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const slot = slotOf(o.slot), name = str(o.name, 16);
  if (slot === null || !name || typeof o.ttl !== "number" || !(o.ttl >= 0)) return null;
  return { slot, name: cleanName(name), seed: seedOf(o.seed), ttl: Math.min(o.ttl, 15 * 60_000) };
}
const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);

export function parsePeer(v: unknown): LivePeer | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const id = str(o.id, 16), name = str(o.name, 16);
  const x = num(o.x), z = num(o.z), px = num(o.px), pz = num(o.pz);
  if (!id || !name || x === null || z === null || px === null || pz === null) return null;
  return { id, name: cleanName(name), genes: parseGenes(o.genes) ?? { hue: 0.6 }, x, z, px, pz, corner: slotOf(o.corner), seed: seedOf(o.seed) };
}

function parseNpcs(v: unknown): Partial<Record<Npc, string>> {
  const out: Partial<Record<Npc, string>> = {};
  if (v && typeof v === "object") for (const n of NPCS) {
    const id = str((v as Record<string, unknown>)[n], 16);
    if (id) out[n] = id;
  }
  return out;
}

export function parseMind(o: Record<string, unknown>): MindLine | null {
  const who = isNpc(o.who) ? o.who : str(o.who, 16);
  if (!who) return null;
  const line: MindLine = { who };
  const act = str(o.act, 16);
  if (act) line.act = act;
  const say = str(o.say, MIND_SAY_MAX);
  if (say) line.say = say;
  const to = say ? str(o.to, 24) : null;
  if (to) line.to = to;
  if ((EMOTES as readonly unknown[]).includes(o.emote)) line.emote = o.emote as Emote;
  const inv = o.invite && typeof o.invite === "object" ? (o.invite as Record<string, unknown>) : null;
  const ia = inv && str(inv.act, 16);
  if (ia) line.invite = str(inv!.to, 16) ? { act: ia, to: str(inv!.to, 16)! } : { act: ia };
  const trade = str(o.trade, 80);
  if (trade) line.trade = trade;
  return line.act || line.say || line.emote || line.invite || line.trade ? line : null;
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
      const aways = (Array.isArray(m.aways) ? m.aways : []).map(parseAway).filter((a): a is LiveAway => !!a).slice(0, SLOT_COUNT);
      const talks = (Array.isArray(m.talks) ? m.talks : []).flatMap((t: unknown): [string, string][] => {
        const [a, b] = Array.isArray(t) ? [str(t[0], 16), str(t[1], 16)] : [null, null];
        return a && b ? [[a, b]] : [];
      });
      return h.welcome(id, slotOf(m.corner), m.peers.map(parsePeer).filter((p): p is LivePeer => !!p).slice(0, 32), aways, parseNpcs(m.npcs), talks);
    }
    case "talking": {
      const id = str(m.id, 16), w = str(m.with, 16);
      return id && w ? h.talking?.(id, w, m.on === true) : undefined;
    }
    case "talkNo": {
      const w = str(m.with, 16);
      return w ? h.talkNo?.(w) : undefined;
    }
    case "mind": {
      const id = str(m.id, 16), line = parseMind(m);
      return id && line ? h.mind?.(id, line) : undefined;
    }
    case "npcHost": {
      if (!isNpc(m.npc)) return;
      if (m.host === null) return h.npcHost?.(m.npc, null);
      const host = str(m.host, 16);
      return host ? h.npcHost?.(m.npc, host) : undefined;
    }
    case "npcState": {
      const log = Array.isArray(m.log) ? m.log.filter((l): l is string => typeof l === "string").map((l) => l.slice(0, 120)).slice(-30) : null;
      return isNpc(m.npc) && log ? h.npcState?.(m.npc, log) : undefined;
    }
    case "ask": {
      const from = str(m.from, 16), text = str(m.text, 80);
      const scene = typeof m.scene === "string" ? cleanScene(m.scene) || undefined : undefined;
      return isNpc(m.npc) && from && text ? h.ask?.(m.npc, from, str(m.name, 16) ?? "someone", text, scene) : undefined;
    }
    case "askNo":
      return isNpc(m.npc) ? h.askNo?.(m.npc) : undefined;
    case "away": {
      const a = parseAway(m.away);
      return a ? h.away?.(a) : undefined;
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
    case "pose": {
      const id = str(m.id, 16);
      return id ? h.pose(id, str(m.pose, 12) || null, m.flip === true) : undefined;
    }
    case "npcs":
      return Array.isArray(m.list) ? h.npcs?.(m.list as NpcSpot[]) : undefined;
    case "farm": {
      const id = str(m.id, 16);
      return id && Array.isArray(m.plots) ? h.farm?.(id, m.plots as FarmPlot[]) : undefined;
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
  private readonly sayNext = new Map<string, number>(); // mind -> earliest time (ms) its next spoken line may go
  private retries = 0;
  private stopped = false;
  private full = false;
  private ping: ReturnType<typeof setInterval> | null = null;
  status: LiveStatus = "offline";
  myId: string | null = null; // our id in the room, from the welcome

  constructor(
    private readonly url: string,
    private readonly hello: () => { name: string; genes: Genes; groundSeed?: number; slot?: number } & Me,
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
        welcome: (id, corner, peers, aways, npcs) => {
          this.myId = id;
          this.h.welcome(id, corner, peers, aways, npcs);
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

  // A mind line for one of my pets or an NPC I host; `mem` (NPCs only) goes to the room's NPC log.
  // The room takes one spoken line per mind per 3 s, so spoken lines wait their turn here (in order)
  // instead of being dropped; a line that would wait over MIND_QUEUE_MS is stale and skipped.
  npcs(list: NpcSpot[]): boolean {
    return this.send({ t: "npcs", list });
  }

  farm(plots: FarmPlot[]): boolean {
    return this.send({ t: "farm", plots });
  }

  pose(pose: string | null, flip: boolean): boolean {
    return this.send({ t: "pose", pose, flip });
  }

  mind(line: MindLine & { mem?: string }): boolean {
    const say = line.say?.replace(/\s+/g, " ").trim().slice(0, MIND_SAY_MAX);
    const msg = { t: "mind", ...line, say: say || undefined }; // undefined fields drop out of the JSON
    if (!say) return this.send(msg);
    const now = Date.now();
    const at = Math.max(now, this.sayNext.get(line.who) ?? 0);
    if (at - now > MIND_QUEUE_MS) return false;
    this.sayNext.set(line.who, at + MIND_GAP_MS);
    if (at === now) return this.send(msg);
    setTimeout(() => this.send(msg), at - now);
    return true;
  }

  // A question for an NPC hosted on another machine (the room relays it to that host's local model).
  ask(npc: Npc, text: string, scene = ""): boolean {
    const t = text.replace(/\s+/g, " ").trim().slice(0, SAY_MAX);
    const sc = cleanScene(scene);
    return t ? this.send(sc ? { t: "ask", npc, text: t, scene: sc } : { t: "ask", npc, text: t }) : false;
  }

  // Heartbeat + model speed, so the room can pick NPC hosts (the server takes one per ~10 s).
  cap(tps: number, webgpu: boolean): boolean {
    return this.send({ t: "cap", tps, webgpu });
  }

  // `to` = a player in an open private chat; without it the line is public room chat.
  say(text: string, to?: string): boolean {
    const t = text.replace(/\s+/g, " ").trim().slice(0, SAY_MAX);
    return t ? this.send(to ? { t: "say", text: t, to } : { t: "say", text: t }) : false;
  }

  // Opens or renews a private chat with a player or an NPC; no argument ends mine.
  talk(withWho?: string): boolean {
    return this.send(withWho ? { t: "talk", with: withWho } : { t: "talk" });
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

  // Say hello again (new pet or name): drop the socket quietly and reconnect at once.
  rejoin() {
    if (this.stopped || !this.ws) return;
    const ws = this.ws;
    ws.onclose = null;
    this.ws = null;
    ws.close();
    this.retries = 0;
    this.connect();
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
