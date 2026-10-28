import { homeToWire, parseHome, type Slot } from "../game/home";
import { parsePorch } from "../game/decor";
import { sizeOf } from "./battle";
import type { EnemyCtx, EnemyDef } from "./enemies";
import { validateMemo, type Memo } from "./memo";
import { memoPolicy } from "./policy";
import { DEFAULT_PET, type Action, type ArchetypeId, type EnemyAct, type Intent, type Observation, type PetSpec } from "./types";

// Ghosts: another player's pet (name, genes, memo) fought on this device. The ghost decides with
// memoPolicy on its own memo, from its own point of view, so it is the same brain its owner coached.

export type Genes = Record<string, number>; // normalized 0..1 knobs: hue, build, ears, tail

export interface Ghost {
  id: string;
  name: string;
  genes: Genes;
  memo: Memo;
  decor: Slot[]; // the owner's home plot, where the ghost fight takes place
  porch?: Slot[]; // items on the owner's A-frame porch (seed ghosts; the server does not carry it yet)
  seed: boolean; // a built-in ghost, not a real player's
}

// Ghosts are rule-driven pets with no single readable pattern, so to the player's memo they look like
// the patternless archetype. Rules like "when the enemy is a brute" therefore never fire against one.
export const GHOST_ARCHETYPE: ArchetypeId = "bully";

// Our pet's genes; with build 0.5 they map exactly onto DEFAULT_PET.
export const PET_GENES: Genes = { hue: 0.07, build: 0.5, ears: 0.5, tail: 0.5 };

const gene = (g: Genes, k: string, fallback = 0.5) => {
  const v = g[k];
  return typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
};

// Build trades size and HP for speed; every gene set gets the same total budget, so a crafted ghost
// cannot buy power.
export function ghostPet(genes: Genes, name = "Ghost"): PetSpec {
  const b = gene(genes, "build");
  return {
    name,
    maxHp: DEFAULT_PET.maxHp - 4 + Math.round(8 * b),
    atk: DEFAULT_PET.atk,
    spd: DEFAULT_PET.spd + 2 - Math.round(4 * b),
    size: DEFAULT_PET.size - 2 + Math.round(4 * b),
  };
}

export const ghostHue = (genes: Genes): number => gene(genes, "hue");

// What the player's last move looks like from the ghost's side of the arena.
function intentFromPlayer(last: Action | "none", playerHpPct: number): Intent {
  if (last === "guard") return "guarding";
  if (last === "flee") return "scared";
  if (last === "emote" || last === "befriend") return "calm";
  return playerHpPct < 40 ? "scared" : "idle";
}

// A ghost attacking right after it guarded winds up a heavy hit (it saved its strength), so its guard
// pattern is readable and the player's pet can learn to answer it.
export function toEnemyAct(a: Action, last: Action | "none"): EnemyAct {
  switch (a) {
    case "attack": return last === "guard" ? "heavy" : "strike";
    case "guard": return "guard";
    case "flee": return "flee";
    default: return "idle"; // emote / befriend: no damage this turn
  }
}

export function ghostObservation(c: EnemyCtx, ghostLast: Action | "none", playerSize: Observation["size"]): Observation {
  return {
    turn: c.turn,
    myHpPct: Math.round(c.enemyHpPct),
    enemyHpPct: Math.round(c.myHpPct),
    enemy: GHOST_ARCHETYPE,
    size: playerSize,
    intent: intentFromPlayer(c.petLast, c.myHpPct),
    last: ghostLast,
  };
}

// The ghost as a battle opponent. It keeps its own last move, so build a fresh one for every battle.
export function ghostEnemyDef(g: Ghost, opponent: PetSpec = DEFAULT_PET): EnemyDef {
  const spec = ghostPet(g.genes, g.name);
  const policy = memoPolicy(g.memo);
  const playerSize = sizeOf(opponent.size, spec.size);
  let last: Action | "none" = "none";
  return {
    id: GHOST_ARCHETYPE,
    label: g.name,
    maxHp: spec.maxHp,
    atk: spec.atk,
    spd: spec.spd,
    size: spec.size,
    befriendBase: 0.15,
    act: (c) => {
      const a = policy(ghostObservation(c, last, playerSize));
      const act = toEnemyAct(a, last);
      last = a;
      return act;
    },
  };
}

// Display-safe name: the server already cleans names, but a ghost may also come from a cache or a
// different server version.
export const safeGhostName = (v: unknown): string =>
  typeof v === "string" ? v.replace(/[^\p{L}\p{N} _'-]+/gu, "").replace(/\s+/g, " ").trim().slice(0, 16) : "";

export function parseGhostRecord(raw: unknown): Ghost | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const name = safeGhostName(o.name);
  if (!name || !o.memo || typeof o.memo !== "object") return null;
  const genes: Genes = {};
  if (o.genes && typeof o.genes === "object") {
    for (const [k, v] of Object.entries(o.genes as Record<string, unknown>).slice(0, 12)) {
      if (typeof v === "number" && Number.isFinite(v)) genes[k] = Math.min(1, Math.max(0, v));
    }
  }
  return {
    id: typeof o.id === "string" ? o.id.slice(0, 32) : "",
    name,
    genes,
    memo: validateMemo(o.memo).memo,
    decor: parseHome(o.decor),
    porch: parsePorch(o.porch),
    seed: o.seed === true,
  };
}

// What gets uploaded: the rules only. Summary and "why" notes are free text the coach wrote from what
// the player typed, so they stay on this device (no personal data in ghosts).
export function ghostPayload(
  name: string,
  genes: Genes,
  memo: Memo,
  decor: readonly Slot[] = [],
): { name: string; genes: Genes; memo: Memo; decor: string[] } {
  return {
    name: safeGhostName(name) || "Pet",
    genes: { ...genes },
    memo: { summary: "", rules: memo.rules.map((r) => ({ if: r.if, do: r.do, why: "" })) },
    decor: homeToWire(decor),
  };
}

// Used when the server is unreachable, so "Fight a ghost" always works offline.
export const LOCAL_SEED_GHOSTS: Ghost[] = [
  {
    id: "local-pip",
    name: "Pip",
    seed: true,
    genes: { hue: 0.55, build: 0.4, ears: 0.7, tail: 0.3 },
    decor: parseHome(["tree", "flower", null, "lamp", null, "flower", "tree", null]),
    porch: parsePorch(["pot", "lamp", null, "rug"]),
    memo: {
      summary: "",
      rules: [
        { if: [{ k: "intent", is: "heavy" }], do: "guard", why: "" },
        { if: [{ k: "enemyHp", op: "<", n: 30 }], do: "attack", why: "" },
        { if: [{ k: "myHp", op: "<", n: 20 }], do: "flee", why: "" },
      ],
    },
  },
  {
    id: "local-bramble",
    name: "Bramble",
    seed: true,
    genes: { hue: 0.3, build: 0.8, ears: 0.2, tail: 0.9 },
    decor: parseHome(["rock", "fence", "fence", "rock", "fence", "fence", "rock", null]),
    porch: parsePorch(["mushroom", null, "lamp", "mushroom"]),
    memo: {
      summary: "",
      rules: [
        { if: [{ k: "intent", is: "guarding" }], do: "guard", why: "" },
        { if: [{ k: "last", is: "guard" }], do: "attack", why: "" },
        { if: [{ k: "myHp", op: "<", n: 50 }, { k: "intent", is: "calm" }], do: "befriend", why: "" },
      ],
    },
  },
  {
    id: "local-zuzu",
    name: "Zuzu",
    seed: true,
    genes: { hue: 0.85, build: 0.15, ears: 0.9, tail: 0.6 },
    decor: parseHome(["flower", "flower", "lamp", "flower", "flower", "lamp", "flower", "flower"]),
    porch: parsePorch(["rug", "pot", "pot", null]),
    memo: {
      summary: "",
      rules: [
        { if: [{ k: "turn", op: "<", n: 3 }], do: "emote", why: "" },
        { if: [{ k: "intent", is: "calm" }], do: "befriend", why: "" },
      ],
    },
  },
];

export const localSeedGhost = (random: () => number = Math.random): Ghost =>
  LOCAL_SEED_GHOSTS[Math.min(LOCAL_SEED_GHOSTS.length - 1, Math.floor(random() * LOCAL_SEED_GHOSTS.length))]!;
