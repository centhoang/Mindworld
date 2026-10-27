// Ghost snapshot stub: a finished pet's genes + memo, stored so other players' devices can run it as an
// opponent (their device runs the ghost's Instinct; the server does no inference). No personal data allowed.

export interface GhostStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  list(opts: { prefix: string; limit: number }): Promise<{ keys: { name: string }[] }>;
}

export interface GhostInput {
  name: string;
  genes: Record<string, number>;
  stats?: Record<string, number>;
  memo: unknown;
}

export const GHOST_PREFIX = "ghost:";
export const GHOST_TTL_SECONDS = 30 * 24 * 3600;
export const GHOST_MAX_BODY = 6000;
const MAX_MEMO_CHARS = 3500;

const isNumRecord = (v: unknown): v is Record<string, number> =>
  !!v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.keys(v).length <= 16 &&
  Object.entries(v).every(([k, n]) => k.length <= 24 && typeof n === "number" && Number.isFinite(n));

export function parseGhost(body: unknown): GhostInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.name !== "string" || b.name.length < 1 || b.name.length > 24) return null;
  if (!isNumRecord(b.genes)) return null;
  if (b.stats !== undefined && !isNumRecord(b.stats)) return null;
  if (b.memo === null || typeof b.memo !== "object") return null;
  if (JSON.stringify(b.memo).length > MAX_MEMO_CHARS) return null;
  return { name: b.name, genes: b.genes, ...(b.stats ? { stats: b.stats } : {}), memo: b.memo };
}

export const isGhostId = (id: string) => /^[a-f0-9]{20}$/.test(id);

export async function saveGhost(store: GhostStore, id: string, ghost: GhostInput, now: number): Promise<void> {
  await store.put(GHOST_PREFIX + id, JSON.stringify({ id, createdAt: now, ...ghost }), {
    expirationTtl: GHOST_TTL_SECONDS,
  });
}

export async function loadGhost(store: GhostStore, id: string): Promise<unknown | null> {
  const raw = await store.get(GHOST_PREFIX + id);
  return raw ? JSON.parse(raw) : null;
}

export async function randomGhost(store: GhostStore, random: () => number): Promise<unknown | null> {
  const { keys } = await store.list({ prefix: GHOST_PREFIX, limit: 100 });
  if (keys.length === 0) return null;
  const pick = keys[Math.min(keys.length - 1, Math.floor(random() * keys.length))]!;
  const raw = await store.get(pick.name);
  return raw ? JSON.parse(raw) : null;
}
