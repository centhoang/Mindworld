// Home plot: a few decor slots around the edge of the pet's floating platform. Pure data + rules here;
// scene.ts draws it, main.ts saves it with the rest of the pet. Ghosts carry their owner's decor, so a
// ghost fight happens on the other player's plot.

export const DECOR = ["tree", "flower", "rock", "lamp", "fence"] as const;
export type DecorKind = (typeof DECOR)[number];
export type Slot = DecorKind | null;

export const HOME_SLOTS = 8;

export const DECOR_ICON: Record<DecorKind, string> = { tree: "🌳", flower: "🌸", rock: "🪨", lamp: "🏮", fence: "🚧" };
export const DECOR_LABEL: Record<DecorKind, string> = { tree: "Tree", flower: "Flowers", rock: "Rock", lamp: "Lamp", fence: "Fence" };

export const emptyHome = (): Slot[] => Array<Slot>(HOME_SLOTS).fill(null);

// Slots sit on a ring mostly behind the fighters (negative z is away from the camera).
const SLOT_DEG = [-20, 20, 50, 80, 100, 130, 160, 200];
export function slotPosition(i: number, radius = 3.0): { x: number; z: number; deg: number } {
  const deg = SLOT_DEG[((i % HOME_SLOTS) + HOME_SLOTS) % HOME_SLOTS]!;
  const a = (deg * Math.PI) / 180;
  return { x: radius * Math.cos(a), z: -radius * Math.sin(a), deg };
}

// Clicking a slot cycles empty -> tree -> flower -> ... -> empty.
export function cycleSlot(home: readonly Slot[], i: number): Slot[] {
  const next = parseHome(home);
  if (i < 0 || i >= HOME_SLOTS) return next;
  const cur = next[i] ?? null;
  const at = cur === null ? -1 : DECOR.indexOf(cur);
  next[i] = at + 1 < DECOR.length ? DECOR[at + 1]! : null;
  return next;
}

const isKind = (v: unknown): v is DecorKind => typeof v === "string" && (DECOR as readonly string[]).includes(v);

// Accepts saved data or a ghost's decor list; anything unknown becomes an empty slot. Never throws.
export function parseHome(raw: unknown): Slot[] {
  const out = emptyHome();
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < HOME_SLOTS; i++) out[i] = isKind(raw[i]) ? raw[i] : null;
  return out;
}

// Wire format for ghosts: "" marks an empty slot (JSON-friendly, matches the worker's validator).
export const homeToWire = (home: readonly Slot[]): string[] => parseHome(home).map((s) => s ?? "");

export const decorCount = (home: readonly Slot[]): number => home.filter((s) => s !== null).length;

export function decorSummary(home: readonly Slot[]): string {
  const counts = new Map<DecorKind, number>();
  for (const s of home) if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  if (counts.size === 0) return "a bare plot";
  return [...counts].map(([k, n]) => `${DECOR_ICON[k]}${n > 1 ? `×${n}` : ""}`).join(" ");
}
