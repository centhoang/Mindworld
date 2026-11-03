import { roll } from "./rng";
import type { Action, ArchetypeId, EnemyAct, Intent } from "./types";

export interface EnemyDef {
  id: ArchetypeId;
  label: string;
  maxHp: number;
  atk: number;
  spd: number;
  size: number;
  befriendBase: number; // chance for befriend with no calm and a healthy enemy
  act(ctx: EnemyCtx): EnemyAct;
  tell?(): Intent | undefined; // what the pet sees this turn when it differs from the real act (a feint)
}

export interface EnemyCtx {
  seed: number;
  turn: number;
  enemyHpPct: number;
  myHpPct: number;
  petLast: Action | "none";
  calm: number; // how many times the pet emoted at this enemy
}

const ch = 0; // roll channel for enemy decisions

// Each archetype has one readable pattern a coach can discover; "bully" has none (the control).
export const ENEMIES: Record<ArchetypeId, EnemyDef> = {
  // Every third turn it telegraphs a heavy hit; guarding on that turn blunts it.
  brute: {
    id: "brute", label: "Brute", maxHp: 48, atk: 3, spd: 3, size: 9, befriendBase: 0.05,
    act: ({ turn }) => (turn % 3 === 0 ? "heavy" : "strike"),
  },
  // Gets scared when hurt and tries to run; befriending a scared one nearly always works.
  skitter: {
    id: "skitter", label: "Skitter", maxHp: 22, atk: 5, spd: 8, size: 2, befriendBase: 0.3,
    act: (c) => (c.enemyHpPct < 40 && roll(c.seed, c.turn, ch) < 0.6 ? "flee" : "strike"),
  },
  // Guards after being hit; attacking into a guard does little. Calm it with emotes instead.
  turtle: {
    id: "turtle", label: "Turtle", maxHp: 40, atk: 5, spd: 2, size: 5, befriendBase: 0.15,
    act: (c) => (c.petLast === "attack" && roll(c.seed, c.turn, ch) < 0.85 ? "guard" : "strike"),
  },
  // Friendly: mostly idle, and each emote calms it further, which makes befriend work.
  pal: {
    id: "pal", label: "Pal", maxHp: 30, atk: 5, spd: 5, size: 5, befriendBase: 0.3,
    act: (c) => (roll(c.seed, c.turn, ch) < 0.55 - 0.3 * c.calm ? "strike" : "idle"),
  },
  // No exploitable pattern: mostly strikes, sometimes telegraphs a heavy hit at random.
  bully: {
    id: "bully", label: "Bully", maxHp: 34, atk: 6, spd: 5, size: 5, befriendBase: 0.05,
    act: (c) => (roll(c.seed, c.turn, ch) < 0.2 ? "heavy" : "strike"),
  },
};

export const HEAVY_MULT = 2.4;
