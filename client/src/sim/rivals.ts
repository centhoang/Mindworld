import { Battle, sizeOf } from "./battle";
import type { EnemyDef } from "./enemies";
import { GHOST_ARCHETYPE, ghostEnemyDef, ghostObservation, ghostPet, toEnemyAct, type Genes } from "./ghost";
import { MAX_CONDS, MAX_RULES, ruleMatches, validateMemo, type Cond, type Memo, type Rule } from "./memo";
import { baselinePolicy, memoPolicy } from "./policy";
import { DEFAULT_PET, type Action, type PetSpec, type Replay } from "./types";

// Villagers' pets as rivals. Each villager trains a pet with its own style (a persona memo), and before a duel it
// adapts to the player's memo: Muse Spark writes counter-rules when the cloud is on (worker /api/rival), else the
// local rule below reads what the player's pet does most. The fight is a ghost fight (sim/ghost.ts), so the rival
// decides with the same memo DSL a player's pet uses. Pure.

export type RivalOwner = "elder" | "mo" | "ama" | "pip";
export const RIVAL_OWNERS: readonly RivalOwner[] = ["elder", "mo", "ama", "pip"];
const OWNER_NAME: Record<RivalOwner, string> = { elder: "Elder", mo: "Mo", ama: "Ama", pip: "Pip" };

export interface Rival {
  owner: RivalOwner;
  ownerName: string;
  name: string; // the pet's own name
  genes: Genes;
  memo: Memo;
  style: string; // how the owner trains it, in plain words (also the cloud prompt's brief)
}

const r = (cond: Cond[], act: Action, why: string): Rule => ({ if: cond, do: act, why });

// Mo waits behind a guard and hits back; Ama makes friends; the Elder reads the fight; Pip never stops attacking.
const RIVALS: Record<RivalOwner, Omit<Rival, "owner" | "ownerName">> = {
  elder: {
    name: "Sage",
    genes: { hue: 0.33, accent: 0.2, ears: 0.9, tail: 0.7, horns: 0.9, pattern: 0.3, size: 0.6, build: 0.55 },
    style: "balanced and wise: finishes a weak foe, strikes hard after a block, guards when hurt",
    memo: { summary: "", rules: [
      r([{ k: "enemyHp", op: "<", n: 35 }], "attack", "finish it"),
      r([{ k: "last", is: "guard" }], "attack", "strike after the block"),
      r([{ k: "myHp", op: "<", n: 50 }], "guard", "catch its breath"),
      r([{ k: "intent", is: "guarding" }], "emote", "wait out the shell"),
    ] },
  },
  mo: {
    name: "Ripple",
    genes: { hue: 0.55, accent: 0.7, ears: 0.5, tail: 0.9, horns: 0.1, pattern: 0.9, size: 0.5, build: 0.7 },
    style: "patient counter-puncher: guards first, then hits back hard right after a guard",
    memo: { summary: "", rules: [
      r([{ k: "last", is: "guard" }], "attack", "hit back after the block"),
      r([{ k: "intent", is: "idle" }], "guard", "let it swing first"),
      r([{ k: "turn", op: "<", n: 1 }], "guard", "watch first"),
    ] },
  },
  ama: {
    name: "Honey",
    genes: { hue: 0.12, accent: 0.4, ears: 0.7, tail: 0.5, horns: 0.1, pattern: 0.3, size: 0.4, build: 0.4 },
    style: "friendly but no pushover: answers kindness with kindness, blocks a bully and hits back",
    memo: { summary: "", rules: [
      r([{ k: "intent", is: "calm" }], "emote", "kindness back"),
      r([{ k: "last", is: "guard" }], "attack", "push back"),
      r([{ k: "intent", is: "idle" }], "guard", "no bullies"),
    ] },
  },
  pip: {
    name: "Zip",
    genes: { hue: 0.9, accent: 0.1, ears: 0.1, tail: 0.3, horns: 0.5, pattern: 0.1, size: 0.3, build: 0.15 },
    style: "reckless and fast: attacks every turn and never runs",
    memo: { summary: "", rules: [
      r([{ k: "myHp", op: "<", n: 25 }], "attack", "never give up"),
      r([{ k: "intent", is: "guarding" }], "attack", "keep swinging"),
    ] },
  },
};

export function rivalOf(owner: RivalOwner): Rival {
  const b = RIVALS[owner];
  return { owner, ownerName: OWNER_NAME[owner], ...b, genes: { ...b.genes }, memo: { summary: "", rules: [...b.memo.rules] } };
}

export const isRivalOwner = (v: unknown): v is RivalOwner => typeof v === "string" && (RIVAL_OWNERS as readonly string[]).includes(v);
export const rivalLabel = (rv: Rival): string => `${rv.ownerName}'s ${rv.name}`.slice(0, 12);

// What the player's pet does most, from its memo and its last fights.
export function habits(memo: Memo, recent: readonly Replay[] = []): Record<Action, number> {
  const n: Record<Action, number> = { attack: 0, guard: 0, flee: 0, emote: 0, befriend: 0 };
  for (const rule of memo.rules) n[rule.do] += 2; // a rule is a plan; count it over a single move
  for (const rp of recent.slice(-4)) for (const t of rp.turns) n[t.action] += 1;
  return n;
}

// Counter-plans a villager knows. (A rival sees "guarding" after the player's pet guards, "calm" after it emotes or
// befriends, "idle" after it attacks.)
export const COUNTER_PLANS: readonly (readonly Rule[])[] = [
  [r([{ k: "intent", is: "idle" }], "guard", "block its attacks"), r([{ k: "last", is: "guard" }], "attack", "then hit back")],
  [r([{ k: "intent", is: "calm" }], "attack", "strike while it plays nice")],
  [r([{ k: "intent", is: "guarding" }], "emote", "let its guard wait"), r([{ k: "last", is: "emote" }], "attack", "then strike")],
  [r([{ k: "intent", is: "guarding" }], "guard", "guard against its guard"), r([{ k: "last", is: "guard" }], "attack", "then hit hard")],
  [r([{ k: "enemyHp", op: "<", n: 50 }], "attack", "press a hurt pet")],
];

// The rival's memo for this fight: counter-rules first, then the persona's own.
export function rivalMemo(rv: Rival, counter: readonly Rule[]): Memo {
  return validateMemo({ summary: "", rules: [...counter, ...rv.memo.rules].slice(0, MAX_RULES) }).memo;
}

export const REHEARSALS = 32; // sparring rounds in the villager's head per plan

// A plan used only part of the time: later in the fight, or once the rival is hurt. Softer plans let a rival land
// near a fair fight instead of jumping from easy to crushing.
const gated = (plan: readonly Rule[], c: Cond): Rule[] => plan.map((x) => (x.if.length < MAX_CONDS ? { ...x, if: [...x.if, c] } : x));
const variants = (plan: readonly Rule[]): Rule[][] => [[...plan], gated(plan, { k: "turn", op: ">=", n: 3 }), gated(plan, { k: "myHp", op: "<", n: 60 })];

// How often the player's memo (its deterministic proxy) beats this rival, over fixed sparring seeds.
export function playerWinRate(rv: Rival, player: Memo, rounds = REHEARSALS, pet: PetSpec = DEFAULT_PET): number {
  const policy = memoPolicy(player);
  let won = 0;
  for (let s = 0; s < rounds; s++) {
    const b = new Battle({ enemy: GHOST_ARCHETYPE, seed: 7919 * (s + 1), pet, enemyDef: rivalDef(rv, pet, []) });
    while (!b.done) b.step(policy(b.observe()));
    const end = duelEnd(b.replay());
    if (end === "win" || end === "friends") won++;
  }
  return won / rounds;
}

export const FAIR = 0.4; // the player's chance a rival aims for: a hard fight that good teaching still wins
export const CLOUD_SLACK = 0.1; // the villager trusts its own study: the cloud plan wins if it is this close to the best

// The villager studies the player's memo: it spars each plan (its own style, every counter it knows, and the cloud's
// counter-rules when there are any) in its head. Its own style stays when the player's pet would lose to it anyway;
// otherwise it takes the plan that leaves the player closest to a fair chance, never an unwinnable one on purpose.
// The cloud's plan wins when it is within CLOUD_SLACK of the best bundled one.
export type PlanFrom = "own" | "cloud" | "bundled";
export function rehearse(rv: Rival, player: Memo, cloud: readonly Rule[] = []): { memo: Memo; plan: readonly Rule[]; playerWins: number; from: PlanFrom } {
  const own = { memo: rv.memo, plan: [] as readonly Rule[], playerWins: playerWinRate(rv, player), from: "own" as PlanFrom };
  if (own.playerWins <= FAIR) return own;
  let best = own;
  const plans = [...(cloud.length ? variants(cloud).map((p) => [p, "cloud"] as const) : []), ...COUNTER_PLANS.flatMap(variants).map((p) => [p, "bundled"] as const)];
  for (const [plan, from] of plans) {
    const memo = rivalMemo(rv, plan);
    const playerWins = playerWinRate({ ...rv, memo }, player);
    if (Math.abs(playerWins - FAIR) < Math.abs(best.playerWins - FAIR)) best = { memo, plan, playerWins, from };
  }
  if (best.from === "cloud" || !cloud.length) return best;
  const gap = (w: number) => Math.abs(w - FAIR);
  let study: typeof best | null = null;
  for (const plan of variants(cloud)) {
    const memo = rivalMemo(rv, plan);
    const playerWins = playerWinRate({ ...rv, memo }, player);
    if (gap(playerWins) <= gap(best.playerWins) + CLOUD_SLACK && (!study || gap(playerWins) < gap(study.playerWins))) study = { memo, plan, playerWins, from: "cloud" };
  }
  return study ?? best;
}

// The rival as the battle's enemy, logging which of its rules chose each turn's move (-1 = none, its reflex).
// `log[i]` belongs to turn i: the battle picks the enemy's move for a turn before that turn is played.
export function rivalDef(rv: Rival, opponent: PetSpec, log: number[]): EnemyDef {
  const base = ghostEnemyDef({ id: `rival-${rv.owner}`, name: rv.name, genes: rv.genes, memo: rv.memo, decor: [], seed: true }, opponent);
  const playerSize = sizeOf(opponent.size, ghostPet(rv.genes).size);
  let last: Action | "none" = "none";
  return {
    ...base,
    befriendBase: rv.owner === "ama" ? 0.25 : 0.1,
    act: (c) => {
      const o = ghostObservation(c, last, playerSize);
      const i = rv.memo.rules.findIndex((x) => ruleMatches(x, o));
      const a = i >= 0 ? rv.memo.rules[i]!.do : baselinePolicy(o);
      log.push(i);
      const act = toEnemyAct(a, last);
      last = a;
      return act;
    },
  };
}

// --- plain words ------------------------------------------------------------------------------------------
const WHEN: Record<string, string> = {
  "intent:guarding": "after your pet guards",
  "intent:calm": "after your pet plays nice",
  "intent:scared": "when your pet is hurt or runs",
  "intent:idle": "after your pet attacks",
  "last:guard": "right after it guards",
  "last:attack": "after its own attack",
  "last:emote": "after it waits",
};
function whenText(c: Cond, pet: string): string {
  if ("is" in c) return WHEN[`${c.k}:${c.is}`] ?? "";
  if (c.k === "myHp") return c.op === "<" ? `when ${pet} is low on health` : `while ${pet} is healthy`;
  if (c.k === "enemyHp") return c.op === "<" ? `when your pet is below ${c.n}%` : "";
  return c.op === "<" ? "early in the fight" : "later in the fight";
}
const DOES: Record<Action, string> = { attack: "strikes", guard: "guards", flee: "runs", emote: "waits", befriend: "tries to make friends" };

// The lessons that beat every rival together (bench in docs/ai/pet.md): guard its heavy hit, wait while it guards
// (no hitting into a guard), make friends once it is hurt. The first one the memo lacks is the one to teach next.
const has = (m: Memo, act: Action, k: Cond["k"], is?: string) => m.rules.some((x) => x.do === act && x.if.some((c) => c.k === k && (is === undefined || ("is" in c && c.is === is))));
export function nextLesson(m: Memo, fled = false): string {
  const ran = fled ? "Your pet ran when it got hurt. " : "";
  if (!has(m, "guard", "intent", "heavy")) return `${ran}Teach your pet to guard when the foe winds up a heavy hit.`;
  if (!has(m, "befriend", "enemyHp")) return `${ran}Teach your pet to make friends when the foe's HP is below 40%.`;
  if (!has(m, "emote", "intent", "guarding") && !has(m, "guard", "intent", "guarding")) return `${ran}Teach your pet to wait (emote) while the foe guards, not hit into its guard.`;
  return `${ran}Your lessons are right: use your two shouts (keys 1-5) at the turns that matter.`;
}

// What beat the player, read from the replay: the rival rule behind most of the damage, and what to teach next.
export function whyLost(rp: Replay, log: readonly number[], rv: Rival, player: Memo): { why: string; tip: string } {
  const hurtBy = new Map<number, number>();
  let heavy = 0;
  rp.turns.forEach((t, i) => {
    if (t.taken <= 0) return;
    hurtBy.set(log[i] ?? -1, (hurtBy.get(log[i] ?? -1) ?? 0) + t.taken);
    if (t.enemyAct === "heavy") heavy += t.taken;
  });
  const total = [...hurtBy.values()].reduce((a, b) => a + b, 0) || 1;
  const [idx] = [...hurtBy.entries()].sort((a, b) => b[1] - a[1])[0] ?? [-1];
  const rule = idx >= 0 ? rv.memo.rules[idx] : undefined;
  const when = rule?.if.map((c) => whenText(c, rv.name)).filter(Boolean).join(" and ");
  const why = rule && when
    ? `${rv.name} ${DOES[rule.do]} ${when}${rule.do === "attack" && heavy > total / 3 ? ", with a HEAVY hit" : ""}.`
    : `${rv.name} simply out-hit your pet.`;
  return { why, tip: nextLesson(player, rp.how === "pet-fled") };
}

// --- asking for a duel ---------------------------------------------------------------------------------------
const DUEL_WORD = /\b(?:duel(?:s|ing)?|battle|spar(?:ring)?)\b/;
const FIGHT_ME = /\bfight\b.*\b(?:me|us|my pet|our pets|mine)\b|\b(?:pets?)\b.*\bfight\b/;
const ASKS = /\?|\b(?:let'?s|lets|wanna|want to|care to|up for|challenge|ready|how about|shall we|come on)\b/;
const NOT = /\b(?:don'?t|no more|never|stop)\b/;

// "Wanna duel?", "Let's battle!", "Can our pets fight?" A question about some fight is not an ask.
export function duelAsked(line: string): boolean {
  const t = line.toLowerCase().replace(/’/g, "'");
  if (NOT.test(t)) return false;
  return (DUEL_WORD.test(t) && ASKS.test(t)) || (FIGHT_ME.test(t) && ASKS.test(t)) || /\b(?:challenge you|(?:fight|duel|battle) me)\b/.test(t);
}

export type DuelNo = "no-pet" | "night" | "work" | "grudge" | "tired";
export const DUELS_A_DAY = 3; // a pet needs its rest

export function duelRefusal(o: { hasPet: boolean; night: boolean; working: boolean; grudge: boolean; today: number }): DuelNo | null {
  if (!o.hasPet) return "no-pet";
  if (o.grudge) return "grudge";
  if (o.night) return "night";
  if (o.working) return "work";
  return o.today >= DUELS_A_DAY ? "tired" : null;
}

export function refusalLine(no: DuelNo, rv: Rival, player: string): string {
  switch (no) {
    case "no-pet": return `I don't have a pet yet, ${player}! I'm saving up for one.`;
    case "grudge": return `Why should I duel you, ${player}? Make it right with me first.`;
    case "night": return `It's late, ${player}. ${rv.name} is asleep. Ask me tomorrow.`;
    case "work": return `I'm working right now, ${player}. Ask me after my shift.`;
    case "tired": return `${rv.name} has fought enough today, ${player}. Tomorrow!`;
  }
}

const ACCEPT: Record<RivalOwner, string> = {
  elder: "Ha! Sage and I accept. Show me what you taught your pet.",
  mo: "Alright. Ripple has been watching your pet. Let's see.",
  ama: "Oh, a duel! Honey, be nice. Ready when you are!",
  pip: "YES! Zip, go go go!",
};
export const acceptLine = (rv: Rival): string => ACCEPT[rv.owner];

// A villager asks the player: a bored villager on good terms with a pet of its own.
export const challengeLine = (rv: Rival, player: string, rematch: boolean): string =>
  rematch ? `${player}! ${rv.name} wants a rematch. Duel? Say yes if you're in.` : `${player}, want to duel? ${rv.name} is itching for a match. Say yes if you're in.`;

export type DuelEnd = "win" | "loss" | "draw" | "friends"; // from the player's side

// What the villager says after, and what it keeps in memory.
export function afterLine(end: DuelEnd, rv: Rival, player: string): string {
  switch (end) {
    case "win": return rv.owner === "pip" ? `Aww! Next time, ${player}. Zip will be faster!` : `Well fought, ${player}. ${rv.name} will remember that.`;
    case "loss": return rv.owner === "pip" ? `Ha! Zip wins! Again, again!` : `${rv.name} read your pet well. Train it and come back, ${player}.`;
    case "friends": return `Look at them, ${player}. Friends now!`;
    case "draw": return `A draw! Neither pet would give in, ${player}.`;
  }
}

export function duelMemory(end: DuelEnd, rv: Rival, player: string): string {
  switch (end) {
    case "win": return `${player}'s pet beat my ${rv.name} in a duel`;
    case "loss": return `my ${rv.name} beat ${player}'s pet in a duel`;
    case "friends": return `my ${rv.name} and ${player}'s pet became friends in a duel`;
    case "draw": return `my ${rv.name} and ${player}'s pet fought to a draw`;
  }
}

export const duelEnd = (rp: Replay): DuelEnd =>
  rp.how === "befriended" ? "friends" : rp.outcome === "win" || rp.outcome === "escaped" ? "win" : rp.outcome === "timeout" ? "draw" : "loss";
