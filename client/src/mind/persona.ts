// Who a mind is, in plain text (GARP style): name, traits, hobbies, a habit and a short background. Pets
// derive theirs from their genes, so two pets that look different also behave differently; villagers have
// authored cards. Traits also bias the needs sim, so personality shows even when no model is loaded.

import type { Genes } from "../sim/ghost";
import type { Phase } from "../life/clock";
import type { Kind } from "../life/needs";

export interface Persona {
  id: string;
  name: string;
  kind: Kind;
  traits: string[]; // 2-3 adjectives
  hobbies: string[];
  habit: string;
  background: string;
  job?: Job;
}

export interface Job {
  title: string;
  act: string; // the activity that is the work
  phases: Phase[]; // working hours
}

const TRAITS = ["playful", "sleepy", "greedy", "tidy", "chatty", "curious", "grumpy", "gentle"] as const;
const HOBBIES = ["chasing butterflies", "digging holes", "collecting shiny stones", "napping in the sun", "singing", "watching clouds", "rolling in the grass", "dancing"];
const HABITS = ["hums while eating", "naps right after lunch", "greets everyone it meets", "counts the clouds at dusk", "sniffs every flower", "hides its snacks"];

const at = <T>(xs: readonly T[], v: number | undefined): T => xs[Math.floor(Math.abs(v ?? 0.5) * 997) % xs.length]!;

export function petPersona(name: string, g: Genes): Persona {
  const first = at(TRAITS, g.ears);
  let second = at(TRAITS, (g.tail ?? 0.5) + 0.37);
  if (second === first) second = TRAITS[(TRAITS.indexOf(first) + 3) % TRAITS.length]!;
  const body = (g.build ?? 0.5) < 0.34 ? "nimble" : (g.build ?? 0.5) > 0.66 ? "sturdy" : "bouncy";
  const h1 = at(HOBBIES, g.hue);
  let h2 = at(HOBBIES, (g.accent ?? 0.5) + 0.21);
  if (h2 === h1) h2 = HOBBIES[(HOBBIES.indexOf(h1) + 2) % HOBBIES.length]!;
  return {
    id: name,
    name,
    kind: "pet",
    traits: [first, second, body],
    hobbies: [h1, h2],
    habit: at(HABITS, g.pattern),
    background: `${name} lives at the corner by the A-frame with the other pets.`,
  };
}

// The village's people (stage 4 places them on the map; their minds are hosted by players).
export const VILLAGERS: readonly Persona[] = [
  { id: "elder", name: "Elder", kind: "human", traits: ["wise", "gentle", "chatty"], hobbies: ["telling old stories", "tending herbs"], habit: "naps after lunch", background: "The Elder has lived on the islands longest and remembers every pet.", job: { title: "herbalist", act: "tend", phases: ["morning"] } },
  { id: "mo", name: "Mo", kind: "human", traits: ["calm", "curious", "patient"], hobbies: ["fishing", "whittling"], habit: "fishes at dawn", background: "Mo the fisher knows every pond and shares the catch at picnics.", job: { title: "fisher", act: "fish", phases: ["morning"] } },
  { id: "ama", name: "Ama", kind: "human", traits: ["tidy", "generous", "chatty"], hobbies: ["cooking", "throwing parties"], habit: "cleans up after everyone", background: "Ama keeps the market stall, cooks for the whole village and loves a good party.", job: { title: "market keeper", act: "sell", phases: ["morning", "noon"] } },
  { id: "pip", name: "Pip", kind: "human", traits: ["playful", "loud", "curious"], hobbies: ["soccer", "dancing"], habit: "challenges everyone to a game", background: "Pip cuts wood for the village and never stops running.", job: { title: "wood-cutter", act: "chop", phases: ["noon"] } },
];

// Small nudges on the needs sim's scores: who someone is changes what they pick, model or not.
const BIAS: Record<string, Partial<Record<string, number>>> = {
  playful: { ball: 0.25, dance: 0.2, soccer: 0.25 },
  sleepy: { nap: 0.3, sleep: 0.2 },
  greedy: { eat: 0.3, picnic: 0.2, cook: 0.2 },
  tidy: { groom: 0.3, clean: 0.3 },
  chatty: { dance: 0.15, picnic: 0.25 },
  curious: { wander: 0.2, fish: 0.15 },
  grumpy: { ball: -0.15, dance: -0.2, nap: 0.1 },
  gentle: { feed: 0.2, picnic: 0.1 },
  generous: { cook: 0.25, feed: 0.2 },
  calm: { fish: 0.3 },
  patient: { fish: 0.2 },
  loud: { soccer: 0.2, dance: 0.2 },
};
export function traitBias(p: Persona, act: string): number {
  return p.traits.reduce((s, t) => s + (BIAS[t]?.[act] ?? 0), 0);
}

// The persona as prompt text (kept short: the browser model has a small context).
export function personaCard(p: Persona): string {
  return `${p.name} (${p.kind}). Traits: ${p.traits.join(", ")}. Hobbies: ${p.hobbies.join(", ")}. Habit: ${p.habit}. ${p.background}${p.job ? ` Works as ${p.job.title}, ${p.job.phases.join(" and ")}.` : ""}`;
}
