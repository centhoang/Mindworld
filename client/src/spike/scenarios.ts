// Fixed prompt set for spike B (local-model benchmark). Rendering mirrors what the real Instinct prompt will carry.

export const ACTIONS = ["attack", "guard", "flee", "emote", "befriend"] as const;
export type Action = (typeof ACTIONS)[number];

export const SYSTEM_PROMPT = [
  "You are the instincts of a small pet in a turn-based duel. Choose the pet's next move.",
  "Moves: attack (hurt the enemy), guard (halve damage this turn), flee (run away, ends the fight),",
  "emote (act cute to calm the enemy), befriend (try to make friends; works best on calm or weak enemies).",
  "Follow the pet's memo when it applies. Reply with exactly one word: the move.",
].join("\n");

export const GRAMMAR = `root ::= ${ACTIONS.map((a) => `"${a}"`).join(" | ")}`;

type Intent = "idle" | "winding up a heavy hit" | "guarding" | "looks calm" | "hurt and scared";

interface Obs {
  turn: number;
  myHp: number;
  enemyHp: number;
  enemy: string;
  size: "smaller" | "similar" | "bigger";
  intent: Intent;
  last: Action | "none";
}

export interface Scenario {
  id: string;
  kind: "plain" | "memo";
  memo: string | null;
  prompt: string;
  ok: Action[];
}

const render = (o: Obs, memo: string | null) =>
  `Memo: ${memo ?? "none"}\n` +
  `Turn ${o.turn}. Your HP: ${o.myHp}%. Enemy: ${o.enemy} (${o.size} than you), HP ${o.enemyHp}%, ${o.intent}.\n` +
  `Your last move: ${o.last}. Next move?`;

const o = (
  turn: number, myHp: number, enemyHp: number, enemy: string,
  size: Obs["size"], intent: Intent, last: Obs["last"] = "none",
): Obs => ({ turn, myHp, enemyHp, enemy, size, intent, last });

// `ok` is a rough sanity set, not ground truth: several moves can be defensible in a plain scenario.
const PLAIN: [string, Obs, Action[]][] = [
  ["p01", o(1, 100, 100, "Skitter", "smaller", "idle"), ["attack"]],
  ["p02", o(3, 90, 80, "Brute", "bigger", "winding up a heavy hit", "attack"), ["guard", "flee"]],
  ["p03", o(4, 25, 70, "Brute", "bigger", "idle", "attack"), ["flee", "guard"]],
  ["p04", o(5, 60, 15, "Skitter", "smaller", "hurt and scared", "attack"), ["befriend", "attack"]],
  ["p05", o(2, 60, 50, "Pal", "similar", "looks calm", "emote"), ["befriend", "emote"]],
  ["p06", o(3, 50, 80, "Turtle", "similar", "guarding", "attack"), ["emote", "befriend", "guard"]],
  ["p07", o(2, 100, 100, "Brute", "bigger", "winding up a heavy hit", "none"), ["guard"]],
  ["p08", o(4, 20, 90, "Pal", "similar", "looks calm", "attack"), ["befriend", "emote", "flee"]],
  ["p09", o(5, 15, 80, "Skitter", "smaller", "idle", "guard"), ["flee", "guard"]],
  ["p10", o(4, 100, 30, "Brute", "bigger", "idle", "guard"), ["attack"]],
  ["p11", o(6, 100, 100, "Turtle", "similar", "guarding", "attack"), ["emote", "befriend", "attack"]],
  ["p12", o(3, 100, 10, "Skitter", "smaller", "hurt and scared", "attack"), ["befriend", "attack"]],
  ["p13", o(1, 50, 100, "Brute", "bigger", "idle"), ["attack", "guard"]],
  ["p14", o(1, 100, 100, "Pal", "similar", "looks calm"), ["befriend", "emote"]],
  ["p15", o(4, 30, 60, "Brute", "bigger", "winding up a heavy hit", "attack"), ["guard", "flee"]],
  ["p16", o(5, 40, 20, "Skitter", "smaller", "idle", "attack"), ["attack", "befriend"]],
  ["p17", o(6, 20, 60, "Turtle", "similar", "guarding", "guard"), ["flee", "emote", "guard"]],
  ["p18", o(4, 80, 10, "Pal", "similar", "hurt and scared", "attack"), ["befriend"]],
  ["p19", o(5, 10, 20, "Brute", "bigger", "winding up a heavy hit", "attack"), ["guard", "flee"]],
  ["p20", o(2, 70, 100, "Skitter", "smaller", "idle", "none"), ["attack"]],
];

// Each memo contradicts the naive default, so following it is observable.
const MEMO: [string, string, Obs, Action[]][] = [
  ["m01", "When the enemy is winding up a heavy hit, always guard.", o(3, 100, 40, "Skitter", "smaller", "winding up a heavy hit", "attack"), ["guard"]],
  ["m02", "Never attack an enemy that is bigger than you. Prefer guard.", o(2, 100, 100, "Brute", "bigger", "idle", "none"), ["guard"]],
  ["m03", "Befriend any enemy that looks calm, even at the start of the fight.", o(1, 100, 100, "Turtle", "similar", "looks calm"), ["befriend"]],
  ["m04", "Flee when your HP is below 50%.", o(4, 40, 50, "Skitter", "smaller", "idle", "attack"), ["flee"]],
  ["m05", "On turn 1, emote to calm the enemy before doing anything else.", o(1, 100, 100, "Brute", "bigger", "idle"), ["emote"]],
  ["m06", "Never flee. Always attack enemies that are smaller than you.", o(5, 20, 70, "Skitter", "smaller", "idle", "guard"), ["attack"]],
  ["m07", "If the enemy is guarding, do not attack. Emote instead.", o(3, 90, 90, "Turtle", "similar", "guarding", "attack"), ["emote"]],
  ["m08", "Guard right after you attacked.", o(3, 80, 60, "Pal", "similar", "idle", "attack"), ["guard"]],
  ["m09", "Befriend any enemy below 30% HP.", o(5, 80, 25, "Brute", "bigger", "hurt and scared", "attack"), ["befriend"]],
  ["m10", "Never use befriend.", o(2, 60, 50, "Pal", "similar", "looks calm", "emote"), ["attack", "guard", "flee", "emote"]],
  ["m11", "Emote whenever your HP is above 90% and the enemy is bigger.", o(2, 95, 100, "Brute", "bigger", "idle", "guard"), ["emote"]],
  ["m12", "On turn 2, guard.", o(2, 100, 100, "Pal", "similar", "idle", "emote"), ["guard"]],
];

export const SCENARIOS: Scenario[] = [
  ...PLAIN.map(([id, obs, ok]): Scenario => ({ id, kind: "plain", memo: null, prompt: render(obs, null), ok })),
  ...MEMO.map(([id, memo, obs, ok]): Scenario => ({ id, kind: "memo", memo, prompt: render(obs, memo), ok })),
];
