// What a villager has asked and the player has not answered yet, whoever voiced it: the sim or a free model line.
// "Wanna dance?" spoken by the model is the same open offer as one the sim made, so "yes" acts on it. Pure.

import { ACTIVITY } from "../life/activities";
import type { Phase } from "../life/clock";
import type { Good } from "./economy";
import type { Invite } from "./promises";

const ACT_WORD: readonly [RegExp, string][] = [
  [/\b(?:danc(?:e|es|ing)|part(?:y|ies))\b/, "dance"],
  [/\b(?:soccer|football)\b/, "soccer"],
  [/\b(?:fish(?:ing)?|pond)\b/, "fish"],
  [/\b(?:picnic(?:s|king)?|lunch)\b/, "picnic"],
];
const URGES = /\b(?:shall we|let's|lets|join me|come (?:with|and|along))\b/; // an offer even without a question mark
const ASKS = /\b(?:wanna|want (?:to|a|an|some)|care to|how about|what about|up for|fancy|would you like|feel like|ready to)\b/; // "I want to fish." is not one
const BARE = /(?:^|[.,!]\s+)(?:a\s+|some\s+)?(?:dance|soccer|football|fishing|picnic)\b[^.!?]*\?/; // "Kai, soccer this evening?"
const SELLS = /\b(?:buy|take|want|need|like)\b.*\b(wheat|carrots?|tomato(?:e?s)?|fish|wood|herbs?)\b.*\?/;

// `phase` is now: an offer with no time in it means now, or the next part of the day the activity can happen.
export function offerIn(line: string, today: number, phase: Phase): Invite | null {
  const t = line.toLowerCase().replace(/’/g, "'");
  if (!URGES.test(t) && !(t.includes("?") && (ASKS.test(t) || BARE.test(t)))) return null;
  const act = ACT_WORD.find(([w]) => w.test(t))?.[1];
  if (!act) return null;
  const day = today + (/\btomorrow\b/.test(t) ? 1 : 0);
  const said = /\bmorning\b/.test(t) ? "morning" : /\bnoon\b/.test(t) ? "noon" : /\b(?:evening|tonight)\b/.test(t) ? "evening" : null;
  const can = ACTIVITY.get(act)?.phases ?? [];
  const at: Phase = said ?? (day === today && can.includes(phase) ? phase : "evening");
  return { act, occasion: "", day, phase: at };
}

// "Want to buy some fish?" A model line can offer goods too. Null = no such offer.
export function goodOfferedIn(line: string): Good | null {
  const g = SELLS.exec(line.toLowerCase())?.[1];
  return g ? (g.replace(/^tomato.*/, "tomato").replace(/^carrots$/, "carrot").replace(/^herb$/, "herbs") as Good) : null;
}

const YES = /^\s*(?:ok(?:ay)?|k|deal|ye+s+|yep+|yeah+|yup|ya|sure|fine|agreed|alright|right|let'?s(?: do it| go)?|sounds (?:good|great|fun)|why not|i'?m in|im in|count me in|of course|absolutely|definitely|gladly|please|go on)\b/i;
const NO = /^\s*(?:no+|nah+|nope|not (?:now|today|really|this time)|can'?t|cannot|pass|i (?:can'?t|don'?t want)|sorry)\b/i;
const LATER = /\b(?:maybe|later|not yet|in a bit|another time|soon|after)\b/i;

export type Answer = "yes" | "no" | "later" | null;

// How a line answers an open offer. "ok now" is a yes, "maybe later" is not, "no, later" is a later.
export function answerTo(line: string): Answer {
  if (LATER.test(line)) return "later";
  return NO.test(line) ? "no" : YES.test(line) ? "yes" : null;
}

const LEAK = /\bneutral\b|\byou were (?:kind|rude)\b|\bi feel(?:ing)? (?:wary|warm|calm|gentle)\b/i; // the tuned model reads its bond notes out loud
const ASKING = (t: string) => t.includes("?") && (ASKS.test(t.toLowerCase()) || URGES.test(t.toLowerCase()));

// A memory trailing an invitation: "want to join me for a picnic but nobody showed?" keeps only the invitation.
const STALE_TAIL = /,?\s+(?:but|since|after|because|like|when)\s+(?:nobody|no one|you|they|i|we)\b[^.!?]*\b(?:showed|came|come|left|forgot|missed|said|asked|told|didn't|never|was|were)\b[^.!?]*([.!?]+)$/i;
const dropStale = (t: string) => (ASKING(t) || URGES.test(t.toLowerCase()) ? t.replace(STALE_TAIL, "$1") : t);

// What the villager really says of a model line: no notes read aloud, no memory stuck on an invitation, and no second
// invitation while one was just made.
export function cleanReply(text: string, mayAsk: boolean): string {
  const parts = text.split(/(?<=[.!?])\s+/).map(dropStale);
  const kept = parts.filter((t) => !LEAK.test(t) && (mayAsk || !ASKING(t)));
  return kept.join(" ") || parts.filter((t) => !LEAK.test(t)).join(" ") || text;
}
