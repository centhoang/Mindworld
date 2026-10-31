// Long goals: something each villager saves for over days. A goal pulls real choices (it goes to work instead of
// playing, keeps its coins back in a deal, offers its stock to raise money) and ends with a real purchase. The steps
// are authored, so progress is only a count on the purse and coins; pure, with no model or world state here.

import type { Purse } from "./economy";

export interface Goal {
  what: string;
  cost: number;
}

const GOALS: Record<string, readonly Goal[]> = {
  pip: [{ what: "a pet of my own", cost: 45 }, { what: "new soccer boots", cost: 90 }],
  ama: [{ what: "a bigger oven", cost: 60 }, { what: "a feast for the town", cost: 120 }],
  mo: [{ what: "a better fishing rod", cost: 40 }, { what: "a small boat", cost: 110 }],
  elder: [{ what: "a copper kettle", cost: 35 }, { what: "a book of old stories", cost: 80 }],
};

const KEEP_BACK = 0.7; // the share of its coins a saver will not touch in a deal
const NEAR = 0.6; // from here on the goal beats a day off

export const goalOf = (id: string, p: Purse): Goal | null => GOALS[id]?.[p.goals ?? 0] ?? null;
export const reached = (g: Goal | null, p: Purse): boolean => !!g && p.coins >= g.cost;
export const closeTo = (g: Goal | null, p: Purse): boolean => !!g && p.coins >= g.cost * NEAR;
export const spare = (p: Purse): number => Math.floor(p.coins * (1 - KEEP_BACK));
export const goalText = (g: Goal, p: Purse): string => `${g.what}, ${Math.min(p.coins, g.cost)}/${g.cost}c`;

const ASKED = /\b(?:saving (?:up )?for|your (?:goal|dream)|what do you (?:want|dream|wish)|what are you (?:after|working (?:for|toward))|want(?:ing)? to buy)\b/i;

// A question about what it is after gets the real answer, from the books. Null = not such a question.
export function goalAnswer(line: string, g: Goal | null, p: Purse): string | null {
  if (!ASKED.test(line)) return null;
  return g ? `I am saving for ${g.what}. ${p.coins} of ${g.cost} coins so far.` : "I have all I need now.";
}
