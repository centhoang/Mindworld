import type { Genes } from "../sim/ghost";

// Modular pet looks. A pet hatches with random genes (seeded, so a seed always gives the same pet);
// every gene is a normalized 0..1 knob, which is also what the ghost server accepts. Only `build`
// touches battle stats (see ghostPet), and a hatched pet keeps build 0.5, so looks never buy power.

export const EARS = ["pointy", "round", "floppy", "bunny", "tuft"] as const;
export const TAILS = ["none", "nub", "puff", "curl", "fox"] as const;
export const HORNS = ["none", "none", "nubs", "unicorn", "antlers"] as const; // "none" twice: most pets have none
export const PATTERNS = ["plain", "belly", "plain", "stripes"] as const; // "plain" twice: the old spots genes stay valid and now show plain

export type Ears = (typeof EARS)[number];
export type Tail = (typeof TAILS)[number];
export type Horns = (typeof HORNS)[number];
export type Pattern = (typeof PATTERNS)[number];

export interface PetLook {
  hue: number; // body colour (pastel)
  accentHue: number; // ears tips, pattern, tail tip
  ears: Ears;
  tail: Tail;
  horns: Horns;
  pattern: Pattern;
  size: number; // cosmetic scale, 0.88..1.12
}

export const GENE_KEYS = ["hue", "accent", "ears", "tail", "horns", "pattern", "size", "build"] as const;

// Small, fast, good-enough PRNG for looks (mulberry32).
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function randomGenes(seed: number): Genes {
  const r = rng(seed);
  return {
    hue: r3(r()),
    accent: r3(r()),
    ears: r3(r()),
    tail: r3(r()),
    horns: r3(r()),
    pattern: r3(r()),
    size: r3(r()),
    build: 0.5,
  };
}

export const newSeed = (): number => {
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0]!;
  } catch {
    return Math.floor(Math.random() * 2 ** 32);
  }
};

// Keeps only known keys with finite 0..1 values. Returns null when nothing usable is there (old save).
export function parseGenes(raw: unknown): Genes | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const g: Genes = {};
  for (const k of GENE_KEYS) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) g[k] = Math.min(1, Math.max(0, v));
  }
  return typeof g.hue === "number" ? g : null;
}

const pick = <T>(list: readonly T[], v: number | undefined, fallback: T): T =>
  typeof v === "number" && Number.isFinite(v) ? list[Math.min(list.length - 1, Math.floor(Math.max(0, v) * list.length))]! : fallback;

// Missing genes (older ghosts only had hue/build/ears/tail) fall back to the classic look.
export function petLook(g: Genes): PetLook {
  const hue = typeof g.hue === "number" ? g.hue : 0.07;
  const accent = typeof g.accent === "number" ? g.accent : 0.5;
  const size = typeof g.size === "number" ? g.size : 0.5;
  return {
    hue,
    accentHue: (hue + 0.25 + accent * 0.5) % 1, // never too close to the body hue
    ears: pick(EARS, g.ears, "pointy"),
    tail: pick(TAILS, g.tail, "none"),
    horns: pick(HORNS, g.horns, "none"),
    pattern: pick(PATTERNS, g.pattern, "plain"),
    size: 0.88 + Math.min(1, Math.max(0, size)) * 0.24,
  };
}

export const describeLook = (l: PetLook): string =>
  [l.ears === "tuft" ? "tufty" : l.ears, l.pattern === "plain" ? "" : l.pattern, l.horns === "none" ? "" : l.horns, l.tail === "none" ? "" : `${l.tail} tail`]
    .filter(Boolean)
    .join(", ");
