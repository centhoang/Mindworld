import { Battle } from "./battle";
import { ghostEnemyDef, ghostPet, type Genes, type Ghost } from "./ghost";
import { validateMemo, type Memo } from "./memo";
import { memoPolicy } from "./policy";
import type { Action, EnemyAct, Replay } from "./types";

// Live pet-vs-pet duel. The room sends both players the same seed and both pets (rules + genes), and each
// client runs this exact sim, so both see the same fight. Side "a" (the challenger) is the battle's pet,
// side "b" plays the enemy through its own memo, the same way ghosts do.

export interface Fighter {
  id: string;
  name: string;
  genes: Genes;
  memo: Memo;
}

export type DuelResult = "win" | "loss" | "draw" | "friends";

export interface DuelTurn {
  mine: Action;
  theirs: Action;
  theirAct: EnemyAct; // what my opponent did, for the arena animation
  dealt: number;
  taken: number;
  myHp: number;
  theirHp: number;
}

export interface DuelView {
  turns: DuelTurn[];
  result: DuelResult;
  myMaxHp: number;
  theirMaxHp: number;
  replay: Replay;
}

export function parseFighter(v: unknown): Fighter | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.name !== "string" || !o.memo || typeof o.memo !== "object") return null;
  const genes: Genes = {};
  if (o.genes && typeof o.genes === "object") {
    for (const [k, n] of Object.entries(o.genes as Record<string, unknown>).slice(0, 12)) if (typeof n === "number" && Number.isFinite(n)) genes[k] = Math.min(1, Math.max(0, n));
  }
  return { id: o.id.slice(0, 16), name: o.name.replace(/[^\p{L}\p{N} _'-]+/gu, "").slice(0, 16) || "Visitor", genes, memo: validateMemo(o.memo).memo };
}

export function runDuel(a: Fighter, b: Fighter, seed: number): Replay {
  const pet = ghostPet(a.genes, a.name);
  const bGhost: Ghost = { id: b.id, name: b.name, genes: b.genes, memo: b.memo, decor: [], seed: false };
  const battle = new Battle({ enemy: "bully", seed, pet, enemyDef: ghostEnemyDef(bGhost, pet) });
  const policy = memoPolicy(a.memo);
  while (!battle.done) battle.step(policy(battle.observe()));
  return battle.replay();
}

// What the enemy side did, as one of the pet's own actions.
const asAction = (e: EnemyAct): Action => (e === "strike" || e === "heavy" ? "attack" : e === "guard" ? "guard" : e === "flee" ? "flee" : "emote");
const asAct = (a: Action, last: Action | "none"): EnemyAct =>
  a === "attack" ? (last === "guard" ? "heavy" : "strike") : a === "guard" ? "guard" : a === "flee" ? "flee" : "idle";

// The duel from one player's side. Both players get mirror images of one Replay.
export function duelView(a: Fighter, b: Fighter, seed: number, me: "a" | "b"): DuelView {
  const replay = runDuel(a, b, seed);
  const aMax = ghostPet(a.genes).maxHp;
  const bMax = ghostEnemyDef({ id: b.id, name: b.name, genes: b.genes, memo: b.memo, decor: [], seed: false }, ghostPet(a.genes)).maxHp;
  let last: Action | "none" = "none";
  const turns = replay.turns.map((t): DuelTurn => {
    const bAction = asAction(t.enemyAct);
    const view: DuelTurn =
      me === "a"
        ? { mine: t.action, theirs: bAction, theirAct: t.enemyAct, dealt: t.dealt, taken: t.taken, myHp: t.myHp, theirHp: t.enemyHp }
        : { mine: bAction, theirs: t.action, theirAct: asAct(t.action, last), dealt: t.taken, taken: t.dealt, myHp: t.enemyHp, theirHp: t.myHp };
    last = t.action;
    return view;
  });
  const aResult: DuelResult =
    replay.how === "befriended" ? "friends" : replay.outcome === "win" || replay.outcome === "escaped" ? "win" : replay.outcome === "timeout" ? "draw" : "loss";
  const flip: Record<DuelResult, DuelResult> = { win: "loss", loss: "win", draw: "draw", friends: "friends" };
  return { turns, result: me === "a" ? aResult : flip[aResult], myMaxHp: me === "a" ? aMax : bMax, theirMaxHp: me === "a" ? bMax : aMax, replay };
}

// Coins: the winner gets 3, making friends gives both 2, a loss or draw nothing.
export const duelCoins = (r: DuelResult): number => (r === "win" ? 3 : r === "friends" ? 2 : 0);
