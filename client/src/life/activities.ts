// What minds can do. Each activity is pure data: who may do it, where, for how long (game minutes),
// how many take part, what it does to the needs and which pose the renderer plays. The sim runs them;
// a mind (model or utility score) only ever picks one of the valid ids.

import type { Kind, Needs } from "./needs";
import type { Phase } from "./clock";

// Spots on a ground. "home" = anywhere on your own ground; the others are props placed by the world.
export type Place = "home" | "bowl" | "bed" | "lawn" | "mess" | "pet" | "playground" | "picnic" | "pond" | "plaza" | "stall" | "woods"
  | "dancefloor" | "campfire" | "quarry" | "pen" | "repair" | "crate" | "swim";
export type Pose = "stand" | "sleep" | "eat" | "dance" | "kick" | "squat" | "sit" | "fish" | "sweep" | "wiggle" | "cook" | "chop" | "water" | "dig" | "serve"
  | "carry" | "hammer" | "mine" | "warm" | "feed" | "swim";

export interface ActivityDef {
  id: string;
  label: string; // short, for bubbles and logs: "naps", "plays ball"
  who: Kind | "any";
  place: Place;
  minutes: number; // game minutes once started
  min: number; // participants needed (1 = solo)
  max: number;
  fx: Partial<Needs>; // full payout, given over the duration
  pose: Pose;
  phases?: Phase[]; // only at these times of day
  makes?: "poop"; // leaves a mess where it ended
  needsMess?: boolean; // only when a mess exists (clean)
  jobOnly?: boolean; // only for the villager who has this job
  indoors?: boolean; // a villager goes home for this, and is out of sight until it ends
  open?: boolean; // a group activity one may start alone; others see it going and join (a kickabout, a dance)
  after?: string[]; // only right after one of these (hauling what the work made)
  pull?: number; // a pull of its own on the score, beyond the needs it meets (work people like doing)
  peak?: Phase; // its best time of day: a bigger pull then (the evening party)
}

// A group activity: others can join it (needs company to start, or open to whoever comes).
export const isGroup = (def: ActivityDef): boolean => def.min > 1 || !!def.open;

export const ACTIVITIES: readonly ActivityDef[] = [
  // pets
  { id: "eat", label: "eats", who: "pet", place: "home", minutes: 40, min: 1, max: 3, fx: { hunger: 55, fun: 5 }, pose: "eat" },
  { id: "sleep", label: "sleeps", who: "any", place: "bed", minutes: 300, min: 1, max: 4, fx: { energy: 90 }, pose: "sleep", phases: ["night"], indoors: true },
  { id: "nap", label: "naps", who: "pet", place: "home", minutes: 60, min: 1, max: 1, fx: { energy: 30 }, pose: "sleep", phases: ["morning", "noon", "evening"] },
  { id: "poop", label: "poops", who: "pet", place: "lawn", minutes: 10, min: 1, max: 1, fx: { bladder: 100, hygiene: -10 }, pose: "squat", makes: "poop" },
  { id: "groom", label: "grooms", who: "pet", place: "home", minutes: 30, min: 1, max: 1, fx: { hygiene: 35 }, pose: "wiggle" },
  { id: "ball", label: "plays ball", who: "pet", place: "lawn", minutes: 50, min: 2, max: 3, fx: { fun: 45, social: 30, energy: -15 }, pose: "kick", phases: ["morning", "noon", "evening"] },
  { id: "dance", label: "dances", who: "any", place: "dancefloor", minutes: 90, min: 1, max: 8, open: true, fx: { fun: 40, social: 35, energy: -12 }, pose: "dance", phases: ["noon", "evening"], peak: "evening" },
  { id: "wander", label: "wanders", who: "any", place: "home", minutes: 30, min: 1, max: 1, fx: { fun: 8 }, pose: "stand" },
  // humans (player-like villagers; used from stage 2 on)
  { id: "cook", label: "cooks", who: "human", place: "home", minutes: 50, min: 1, max: 2, fx: { hunger: 50, fun: 10 }, pose: "cook", phases: ["morning", "noon", "evening"], indoors: true },
  { id: "clean", label: "cleans up", who: "human", place: "mess", minutes: 15, min: 1, max: 1, fx: { fun: -3, hygiene: -5 }, pose: "sweep", needsMess: true },
  { id: "sell", label: "runs the market stall", who: "human", place: "stall", minutes: 120, min: 1, max: 1, fx: { social: 25, fun: 5 }, pose: "serve", jobOnly: true },
  { id: "chop", label: "chops wood", who: "human", place: "woods", minutes: 90, min: 1, max: 1, fx: { fun: 10, energy: -15 }, pose: "chop", jobOnly: true },
  { id: "tend", label: "tends herbs", who: "human", place: "home", minutes: 90, min: 1, max: 1, fx: { fun: 15 }, pose: "water", jobOnly: true },
  { id: "farm", label: "works the garden", who: "human", place: "home", minutes: 60, min: 1, max: 1, fx: { fun: 12, energy: -5 }, pose: "dig", phases: ["morning", "noon", "evening"] },
  { id: "fish", label: "fishes", who: "human", place: "pond", minutes: 90, min: 1, max: 3, fx: { fun: 35, hunger: 10 }, pose: "fish", phases: ["morning", "noon", "evening"] },
  { id: "campfire", label: "sits by the campfire", who: "human", place: "campfire", minutes: 90, min: 1, max: 6, open: true, fx: { fun: 20, social: 35 }, pose: "warm", phases: ["evening"], pull: 0.45 },
  { id: "haul", label: "hauls goods to the stall", who: "human", place: "crate", minutes: 15, min: 1, max: 1, fx: { fun: 5 }, pose: "carry", after: ["chop", "farm", "mine"] },
  { id: "repair", label: "fixes things up", who: "human", place: "repair", minutes: 60, min: 1, max: 1, fx: { fun: 14, energy: -8 }, pose: "hammer", phases: ["morning", "noon"], pull: 0.5 },
  { id: "mine", label: "mines stone", who: "human", place: "quarry", minutes: 90, min: 1, max: 2, fx: { fun: 10, energy: -15 }, pose: "mine", phases: ["morning", "noon"], pull: 0.4 },
  { id: "feed", label: "feeds the animals", who: "human", place: "pen", minutes: 30, min: 1, max: 2, fx: { fun: 18, social: 10 }, pose: "feed", phases: ["morning", "evening"], pull: 0.45 },
  { id: "swim", label: "goes for a swim", who: "human", place: "swim", minutes: 45, min: 1, max: 3, fx: { fun: 30, hygiene: 25, energy: -10 }, pose: "swim", phases: ["noon"], pull: 0.25 },
  { id: "soccer", label: "plays soccer", who: "any", place: "playground", minutes: 120, min: 1, max: 6, open: true, fx: { fun: 55, social: 30, energy: -25, hygiene: -10 }, pose: "kick", phases: ["morning", "noon", "evening"] },
];

export const ACTIVITY = new Map(ACTIVITIES.map((a) => [a.id, a]));
