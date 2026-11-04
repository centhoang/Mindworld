// "Where is the pond?" has one true answer, so the sim gives it from the real map. The model cannot know the map,
// and a wrong direction hurts more than a plain line. "Where is it?" follows the place the talk was last about.

import type { Phase } from "../life/clock";

export interface Place {
  name: string; // "the pond", "Mo"
  words: readonly string[]; // lower case, as a player would type them
  x: number;
  z: number;
  doing?: string; // people only: "fishes"
}

const ASKS_WAY = /\b(where|wheres|which way|how (do|can|would) (i|we) (get|find|reach)|how far|is it far|find|way to|show me|take me)\b/i;
const POINTS_BACK = /\b(it|that|there|this place|that place)\b|^\s*where\s*[?!.]*\s*$/i;
const ASKS_DOING = /\bwhat(?:'?s| are| r| is)? (?:you|u|up|going on)\b.*\b(doing|up to|up)\b|\bwhat(?:'?re| are) (?:you|u) (?:doing|up to)\b|\bbusy\b/i;

const named = (line: string, words: readonly string[]) => words.some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(line));

// The first place a line mentions, for following the talk.
export function topicOf(line: string, places: readonly Place[]): Place | null {
  return places.find((p) => named(line, p.words)) ?? null;
}

export function askedPlace(line: string, places: readonly Place[], topic: string | null): Place | null {
  if (!ASKS_WAY.test(line)) return null;
  return topicOf(line, places) ?? (POINTS_BACK.test(line) ? places.find((p) => p.name === topic) ?? null : null);
}

export function compass(from: { x: number; z: number }, to: { x: number; z: number }): string {
  const [dx, dz] = [to.x - from.x, to.z - from.z];
  const ns = dz < -Math.abs(dx) / 2 ? "north" : dz > Math.abs(dx) / 2 ? "south" : "";
  const ew = dx > Math.abs(dz) / 2 ? "east" : dx < -Math.abs(dz) / 2 ? "west" : "";
  return ns && ew ? `${ns}-${ew}` : ns || ew || "here";
}

// `self` = the villager's own name, so it does not give directions to itself.
export function directions(from: { x: number; z: number }, p: Place, self = ""): string {
  if (p.name === self) return "You are looking at me!";
  const steps = Math.round(Math.hypot(p.x - from.x, p.z - from.z));
  const who = p.name[0]!.toUpperCase() + p.name.slice(1);
  const way = compass(from, p);
  const where = steps < 4 ? "right here" : steps > 40 ? `far off to the ${way}, about ${steps} steps, over the bridges` : `to the ${way}, about ${steps} steps from here`;
  return `${who} is ${where}.${p.doing ? ` ${who} ${p.doing} now.` : ""}`;
}

// "fishes" to "fish", "has a picnic" to "have a picnic".
export const firstPerson = (label: string) => label.replace(/^has\b/, "have").replace(/^(\w+(?:sh|ch))es\b/, "$1").replace(/^(\w+)s\b/, "$1");

// "Who is the grumpiest here?" is an opinion for the model, not the list of residents.
const ASKS_WHO = /\bwho\b(?!.*\b\w+est\b).*\b(lives?|live here|else|around|here|neighbou?rs?)\b|\bwho(?:'?s| is) here\b/i;

// `people` = "Mo the fisher" style names of everyone who lives here.
export function whoAnswer(line: string, people: readonly { name: string; title?: string }[], self: string): string | null {
  const knows = /\b(?:know|heard of|met|friends? with)\s+(\w+)/i.exec(line)?.[1]?.toLowerCase();
  const other = people.find((p) => p.name.toLowerCase() === knows && p.name !== self);
  if (other) return `Of course I know ${other.name}${other.title ? `, our ${other.title}` : ""}.`;
  if (!ASKS_WHO.test(line)) return null;
  const list = people.filter((p) => p.name !== self).map((p) => (p.title ? `${p.name} the ${p.title}` : p.name));
  return `Me, ${list.slice(0, -1).join(", ")} and ${list.at(-1)}. Plus visitors like you.`;
}

// "Is it far?" wants the distance, not the whole way again.
export function farAnswer(line: string, way: string): string {
  const steps = Number(/about (\d+) steps/.exec(way)?.[1]);
  if (!steps || !/\b(?:far|close|near)\b/i.test(line) || /\bwhere\b/i.test(line)) return way;
  return `${steps < 15 ? "No, it is close" : steps < 40 ? "Not too far" : "Yes, quite a walk"}, about ${steps} steps.`;
}

// The words for the hour (bug 60: "Enjoying the day" came at night).
const WHEN: Record<Phase, string> = { morning: "this morning", noon: "today", evening: "this evening", night: "tonight" };
const ASKS_GROUP = /\b(?:you guys|you all|y'?all|you two|you lot|everyone|everybody)\b/i;

// What this villager is doing, from the sim; "we" when asked as a group and others share the activity.
export function doingAnswer(line: string, label: string | null | undefined, walking: boolean, phase: Phase = "noon", mates = 0): string | null {
  if (!ASKS_DOING.test(line)) return null;
  if (!label) return walking ? `Just out for a walk ${WHEN[phase]}.` : `Not much. Just taking it easy ${WHEN[phase]}.`;
  if (walking) return `Off to ${firstPerson(label)}.`;
  return mates > 0 && ASKS_GROUP.test(line) ? `Right now? We ${firstPerson(label)}.` : `Right now? I ${firstPerson(label)}.`;
}

// What the talk itself already holds: the time, who is speaking, what was just said.
export function talkAnswer(line: string, player: string, last: string | undefined, time: string): string | null {
  if (/\bwhat(?:'?s| is)? (?:the )?time\b|\bwhat time\b/i.test(line)) return `About ${time}.`;
  if (/\bwhat(?:'?s| is) my name\b|\bwho am i\b|\bdo you know my name\b/i.test(line)) return `You are ${player}.`;
  if (/\bwhat did i (?:just |last )?(?:say|ask|tell)/i.test(line)) return last ? `You said "${last}".` : "You have not said much yet.";
  return null;
}

// "Why?" right after talking about a neighbour.
export const whyPerson = (line: string, who: { name: string; title?: string } | undefined): string | null =>
  who && /^\s*why\b\s*[?!.]*\s*$/i.test(line) ? `${who.name} ${who.title ? `is a good ${who.title}` : "is good company"}, and has always been decent to me.` : null;
