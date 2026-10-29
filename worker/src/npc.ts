// Village NPC minds (Elder, Mo, Ama, Pip) run in players' browsers, not on the server: the room picks one
// player to host each NPC, by how fast their local model runs, and moves it when the host leaves or goes
// quiet. The board keeps each NPC's memory log (short lines from its host), so a new host picks the mind up
// where the old one left it. Pure (no Workers APIs), tested directly.

export const NPCS = ["elder", "mo", "ama", "pip"] as const;
export type Npc = (typeof NPCS)[number];

// Activity ids a mind may announce (client: life/activities.ts).
export const MIND_ACTS = ["eat", "sleep", "nap", "poop", "groom", "ball", "dance", "wander", "cook", "clean", "feed", "fish", "picnic", "soccer"] as const;

export const HOST_STALE_MS = 15_000; // no heartbeat for this long: the NPC moves to another player
export const MEM_MAX = 120;
export const LOG_MAX = 30;
const TPS_MAX = 500;

export interface Cap {
  webgpu: boolean;
  tps: number; // measured tokens/s of the player's local model (0 = none loaded)
}

export interface Hostable {
  id: string;
  cap: Cap;
}

export const isNpc = (v: unknown): v is Npc => (NPCS as readonly unknown[]).includes(v);

export function cleanCap(v: unknown): Cap {
  const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const tps = typeof o.tps === "number" && Number.isFinite(o.tps) ? Math.min(TPS_MAX, Math.max(0, Math.round(o.tps * 10) / 10)) : 0;
  return { webgpu: o.webgpu === true, tps };
}

// Higher = better host. Everyone can host (a player without WebGPU runs the scripted/cloud brain), so the
// floor is above zero; a fast WebGPU player wins, and load spreads as each host takes more NPCs.
export const hostScore = (c: Cap, hosted: number): number => (Math.max(1, c.tps) * (c.webgpu ? 1 : 0.1)) / (1 + hosted);

export function cleanMem(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, MEM_MAX);
  return t || null;
}

export interface HostChange {
  npc: Npc;
  host: string | null;
}

export class NpcBoard {
  readonly hosts = new Map<Npc, { host: string; beat: number }>();
  readonly logs = new Map<Npc, string[]>();
  changed = false; // logs changed since the last store

  hostOf(npc: Npc): string | null {
    return this.hosts.get(npc)?.host ?? null;
  }

  hostsMap(): Partial<Record<Npc, string>> {
    return Object.fromEntries([...this.hosts].map(([n, h]) => [n, h.host]));
  }

  log(npc: Npc): string[] {
    return this.logs.get(npc) ?? [];
  }

  // A heartbeat from a host (its `cap` or any line for one of its NPCs) keeps all its NPCs.
  beat(id: string, now: number): void {
    for (const h of this.hosts.values()) if (h.host === id) h.beat = now;
  }

  remember(npc: Npc, line: string): void {
    this.logs.set(npc, [...this.log(npc), line].slice(-LOG_MAX));
    this.changed = true;
  }

  restore(raw: unknown): void {
    if (!raw || typeof raw !== "object") return;
    for (const npc of NPCS) {
      const l = (raw as Record<string, unknown>)[npc];
      if (Array.isArray(l)) this.logs.set(npc, l.map(cleanMem).filter((x): x is string => !!x).slice(-LOG_MAX));
    }
  }

  snapshot(): Record<string, string[]> {
    return Object.fromEntries(this.logs);
  }

  // Give every NPC a live host: NPCs whose host left or went quiet go to the best other player. Players
  // with a local model come first: once anyone has one loaded, NPCs leave hosts without a model (checked on
  // every message, so loading a model pulls NPCs over within one heartbeat). With `balance` (on join/leave),
  // also move NPCs off a host holding 2+ more than another eligible player.
  elect(peers: ReadonlyMap<string, Hostable>, now: number, balance = false): HostChange[] {
    const changes: HostChange[] = [];
    const load = (id: string) => [...this.hosts.values()].filter((h) => h.host === id).length;
    const modeled = [...peers.values()].some((p) => p.cap.tps > 0);
    const eligible = (p: Hostable) => !modeled || p.cap.tps > 0;
    const best = (except?: string) => {
      let pick: Hostable | null = null;
      let score = -1;
      for (const p of [...peers.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
        if (p.id === except || !eligible(p)) continue;
        const s = hostScore(p.cap, load(p.id));
        if (s > score) [pick, score] = [p, s];
      }
      return pick;
    };
    const assign = (npc: Npc, host: string | null) => {
      if (host) this.hosts.set(npc, { host, beat: now });
      else this.hosts.delete(npc);
      changes.push({ npc, host });
    };
    for (const npc of NPCS) {
      const h = this.hosts.get(npc);
      const gone = !h || !peers.has(h.host);
      const quiet = !!h && now - h.beat > HOST_STALE_MS;
      if (!gone && !quiet) continue;
      const next = best(quiet && !gone ? h!.host : undefined) ?? (gone ? null : peers.get(h!.host)!);
      if (next?.id !== h?.host) assign(npc, next?.id ?? null);
      else if (h) h.beat = now; // the quiet host is the only one left: keep it
    }
    for (const npc of NPCS) {
      const h = this.hosts.get(npc);
      const hp = h && peers.get(h.host);
      if (!hp || eligible(hp)) continue;
      const next = best();
      if (next) assign(npc, next.id);
    }
    const pool = [...peers.values()].filter(eligible);
    if (balance && pool.length > 1) {
      for (let guard = 0; guard < NPCS.length; guard++) {
        const ids = pool.map((p) => p.id).sort();
        const most = ids.reduce((a, b) => (load(b) > load(a) ? b : a));
        const least = ids.reduce((a, b) => (load(b) < load(a) ? b : a));
        if (load(most) - load(least) < 2) break;
        const npc = NPCS.find((n) => this.hostOf(n) === most)!;
        assign(npc, least);
      }
    }
    return changes;
  }
}
