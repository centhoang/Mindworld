import type { ArchetypeId } from "../sim/types";

// Canned in-world chatter: short cute lines for whoever the player walks up to, plus the pet's own
// musings. No model calls; picking is pure and seeded by the caller's rng so it is testable.

export type Speaker = "pet" | "elder" | "boss" | "merchant" | "ghost" | ArchetypeId;

export const LINES: Record<Speaker, readonly string[]> = {
  pet: ["What a nice breeze!", "Can we nap on the porch?", "I'm learning so much!", "Look, petals!", "Teach me a new trick?", "Snack time?"],
  elder: ["Ah, a young trainer!", "Lessons stick when they are short.", "Sit a while, child.", "The clouds are kind today."],
  boss: ["I can read your pet's mind...", "Your memo is an open book.", "Come closer. If you dare."],
  merchant: ["Fresh decor, fair prices!", "Coins from fights spend here!", "Pretty things for your corner!"],
  ghost: ["Boo! Just kidding.", "My owner taught me well.", "Want a friendly match?"],
  brute: ["Grr! Me strong!", "Smash first, think later!", "Hmph."],
  skitter: ["Zip zip!", "Can't catch me!", "Tee-hee!"],
  turtle: ["Slow and steady...", "Shell is cozy.", "Mm... sleepy."],
  pal: ["Hi friend!", "Wanna play?", "You look nice today!"],
  bully: ["Out of my meadow!", "Think you can take me?", "Hmph, tiny."],
};

// Voice tuning per speaker: small creatures squeak, the elder and boss are low.
export function voiceFor(who: Speaker): { pitch: number; rate: number } {
  switch (who) {
    case "elder": return { pitch: 0.7, rate: 0.9 };
    case "boss": return { pitch: 0.4, rate: 0.85 };
    case "brute": case "bully": return { pitch: 0.75, rate: 1 };
    case "skitter": return { pitch: 1.9, rate: 1.3 };
    case "turtle": return { pitch: 1, rate: 0.8 };
    case "merchant": return { pitch: 1.1, rate: 1.05 };
    default: return { pitch: 1.6, rate: 1.1 };
  }
}

// Picks a line, never repeating the previous one for that speaker (when it has more than one).
export function pickLine(who: Speaker, rng: () => number, last?: string): string {
  const pool = LINES[who] ?? LINES.pet;
  const options = pool.length > 1 && last ? pool.filter((l) => l !== last) : pool;
  return options[Math.min(options.length - 1, Math.floor(rng() * options.length))]!;
}

// Seconds until the next ambient line: 6..11 s, so chatter stays a sprinkle.
export const nextChatter = (rng: () => number): number => 6 + rng() * 5;

export function speakerFor(kind: string, archetype?: ArchetypeId): Speaker | null {
  if (kind === "wild" || kind === "tamed") return archetype ?? null;
  if (kind === "npc") return "elder";
  if (kind === "boss") return "boss";
  if (kind === "market") return "merchant";
  if (kind === "ghost" || kind === "arena") return "ghost";
  return null;
}
