// What a mind can see around it, as one short line for its prompt, so "what's that by the pond?" gets a real
// answer. A villager talking to a player sees only what is in view of BOTH of them; a pet sees only what is
// close to itself and that a pet cares about (people, pets, food, toys, mess), not the whole street.

export type SeenKind = "person" | "pet" | "thing";

export interface Seen {
  name: string; // "Mo", "a bench", "Sprig"
  kind: SeenKind;
  x: number;
  z: number;
  doing?: string; // activity label: "fishes", "naps"
  petCares?: boolean; // things only: food bowl, ball, poop, bed...
}

export const SCENE_MAX = 300; // chars, also the room/Worker cap
export const VIEW = 6; // world units (tiles) a villager notices
export const PET_VIEW = 3;
const MAX_ITEMS = 8;

// "north-east" style direction from `from` to `to` (screen z grows downwards = south).
function dir(from: { x: number; z: number }, to: { x: number; z: number }): string {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  if (Math.hypot(dx, dz) < 1.5) return "right here";
  const ns = dz < -Math.abs(dx) / 2 ? "north" : dz > Math.abs(dx) / 2 ? "south" : "";
  const ew = dx > Math.abs(dz) / 2 ? "east" : dx < -Math.abs(dz) / 2 ? "west" : "";
  return ns && ew ? `${ns}-${ew}` : ns || ew;
}

function describe(me: { x: number; z: number }, seen: readonly Seen[]): string {
  // Named beings each get a line; plain things of one name are counted ("3 trees") at the nearest one.
  const out: string[] = [];
  const counted = new Map<string, { n: number; at: Seen }>();
  for (const s of seen) {
    if (s.kind !== "thing") {
      out.push(`${s.name}${s.kind === "pet" ? " (a pet)" : ""}${s.doing ? ` ${s.doing}` : ""}, ${dir(me, s)}`);
      continue;
    }
    const c = counted.get(s.name);
    if (c) c.n++;
    else counted.set(s.name, { n: 1, at: s });
  }
  // Only "a tree"-style names are counted; "the pond" is one place even when it has several seats.
  for (const [name, c] of counted) out.push(`${c.n > 1 && /^an? /.test(name) ? `${c.n} ${name.replace(/^an? /, "")}s` : name}, ${dir(me, c.at)}`);
  return out.join("; ");
}

function clip(text: string): string {
  return text.length <= SCENE_MAX ? text : `${text.slice(0, SCENE_MAX - 3).replace(/[;,]?\s+\S*$/, "")}...`;
}

const byDist = (p: { x: number; z: number }) => (a: Seen, b: Seen) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z);

// Villager <-> player: only what both can see (within `view` of each), nearest to the villager first.
export function sharedScene(npc: { x: number; z: number }, player: { x: number; z: number }, all: readonly Seen[], place: string, phase: string, view = VIEW): string {
  const seen = all
    .filter((s) => Math.hypot(s.x - npc.x, s.z - npc.z) <= view && Math.hypot(s.x - player.x, s.z - player.z) <= view)
    .sort(byDist(npc))
    .slice(0, MAX_ITEMS);
  const head = `${place ? `At ${place}` : "Outside"}, ${phase}.`;
  return clip(seen.length ? `${head} In view: ${describe(npc, seen)}.` : head);
}

// A pet's own small world: people and pets close by, plus the things a pet cares about.
export function petScene(pet: { x: number; z: number }, all: readonly Seen[], place: string, phase: string, view = PET_VIEW): string {
  const seen = all
    .filter((s) => (s.kind !== "thing" || s.petCares) && Math.hypot(s.x - pet.x, s.z - pet.z) <= view)
    .sort(byDist(pet))
    .slice(0, MAX_ITEMS);
  const head = `${place ? `At ${place}` : "Outside"}, ${phase}.`;
  return clip(seen.length ? `${head} Close by: ${describe(pet, seen)}.` : head);
}

// Server-side style cleaning for a scene that came over the network (also used by the Worker's copy).
export function cleanScene(v: unknown): string {
  if (typeof v !== "string") return "";
  const t = v.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim();
  return /https?:|www\.|\.(com|net|org|io)\b/i.test(t) ? "" : t.slice(0, SCENE_MAX);
}
