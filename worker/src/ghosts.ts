import { parseGhostMemo, type GhostMemo } from "./memo-dsl";

// Ghost snapshots: a pet's name, cosmetic/build genes and memo, stored so other players' devices can run
// it as an opponent (their device runs the ghost's memo policy; the server does no inference).
// No personal data: only these three fields are kept, text is cleaned, and records expire.

export interface GhostStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  list(opts: { prefix: string; limit: number }): Promise<{ keys: { name: string }[] }>;
}

export interface GhostInput {
  name: string;
  genes: Record<string, number>;
  memo: GhostMemo;
  decor: string[]; // home-plot slots: a decor kind or "" (empty)
}

export interface GhostRecord extends GhostInput {
  id: string;
  createdAt: number;
  seed?: true;
}

export const GHOST_PREFIX = "ghost:";
export const GHOST_TTL_SECONDS = 30 * 24 * 3600;
export const GHOST_MAX_BYTES = 4096;
export const GHOST_POSTS_PER_HOUR = 10;
const RATE_PREFIX = "rl:ghost:";
const MAX_GENES = 12;
const MAX_NAME = 16;
export const DECOR_KINDS = ["tree", "flower", "rock", "lamp", "fence", "pot", "mushroom", "rug", "sunflower", "pond", "birdhouse"] as const; // client/src/game/home.ts
const MAX_DECOR = 8;

// Optional; a missing list is an empty plot.
function parseDecor(v: unknown): string[] | null {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > MAX_DECOR) return null;
  return v.every((d) => d === "" || (DECOR_KINDS as readonly string[]).includes(d)) ? [...(v as string[])] : null;
}

// Letters, digits, spaces and a little punctuation; everything else (markup, dots, slashes, @) is dropped,
// so a name can never form a URL, an address or HTML.
export function cleanName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const name = v
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} _'-]+/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME)
    .trim();
  return name.length > 0 ? name : null;
}

// Genes are normalized 0..1 knobs; the client derives a balanced stat line from them, so a crafted
// ghost cannot buy extra power.
const isGenes = (v: unknown): v is Record<string, number> =>
  !!v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.keys(v).length <= MAX_GENES &&
  Object.entries(v).every(([k, n]) => /^[a-z][a-zA-Z0-9]{0,15}$/.test(k) && typeof n === "number" && n >= 0 && n <= 1);

export function parseGhost(body: unknown): GhostInput | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const name = cleanName(b.name);
  if (!name || !isGenes(b.genes)) return null;
  const memo = parseGhostMemo(b.memo);
  const decor = parseDecor(b.decor);
  if (!memo || !decor) return null;
  return { name, genes: { ...b.genes }, memo, decor };
}

// Records read back from KV are re-validated, so an old-format or tampered entry is never served.
function parseRecord(raw: string | null): GhostRecord | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const g = parseGhost(o);
    if (!g || typeof o.id !== "string" || !isGhostId(o.id) || typeof o.createdAt !== "number") return null;
    return { id: o.id, createdAt: o.createdAt, ...g };
  } catch {
    return null;
  }
}

export const isGhostId = (id: string) => /^[a-f0-9]{20}$/.test(id);

// Served when the store is empty, so "Fight a ghost" always has an opponent.
export const SEED_GHOST: GhostRecord = {
  id: "0000000000000000seed",
  createdAt: 0,
  seed: true,
  name: "Pip",
  genes: { hue: 0.55, build: 0.4, ears: 0.7, tail: 0.3 },
  decor: ["tree", "flower", "", "lamp", "", "flower", "tree", ""],
  memo: {
    summary: "Guards heavy hits, finishes hurt foes, runs when nearly out.",
    rules: [
      { if: [{ k: "intent", is: "heavy" }], do: "guard", why: "blunt the big hit" },
      { if: [{ k: "enemyHp", op: "<", n: 30 }], do: "attack", why: "finish it" },
      { if: [{ k: "myHp", op: "<", n: 20 }], do: "flee", why: "live to fight again" },
    ],
  },
};

export async function saveGhost(store: GhostStore, id: string, ghost: GhostInput, now: number): Promise<void> {
  const rec: GhostRecord = { id, createdAt: now, ...ghost };
  await store.put(GHOST_PREFIX + id, JSON.stringify(rec), { expirationTtl: GHOST_TTL_SECONDS });
}

export async function loadGhost(store: GhostStore, id: string): Promise<GhostRecord | null> {
  return parseRecord(await store.get(GHOST_PREFIX + id));
}

export async function randomGhost(store: GhostStore, random: () => number): Promise<GhostRecord> {
  const { keys } = await store.list({ prefix: GHOST_PREFIX, limit: 100 });
  // A couple of tries in case a listed key just expired or holds an invalid record.
  for (let i = 0; i < Math.min(3, keys.length); i++) {
    const pick = keys[Math.min(keys.length - 1, Math.floor(random() * keys.length))]!;
    const rec = parseRecord(await store.get(pick.name));
    if (rec) return rec;
  }
  return SEED_GHOST;
}

// Best-effort per-client limit on ghost uploads (KV is eventually consistent, so a burst can slip a few
// extra through; uploads cost nothing but storage, which the TTL bounds anyway).
export async function allowGhostPost(store: GhostStore, clientKey: string, now: number): Promise<boolean> {
  const key = `${RATE_PREFIX}${clientKey}:${Math.floor(now / 3_600_000)}`;
  const count = Number((await store.get(key)) ?? "0") || 0;
  if (count >= GHOST_POSTS_PER_HOUR) return false;
  await store.put(key, String(count + 1), { expirationTtl: 3700 });
  return true;
}
