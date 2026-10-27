export const ACTIONS = ["attack", "guard", "flee", "emote", "befriend"] as const;
export type Action = (typeof ACTIONS)[number];

export const ARCHETYPES = ["brute", "skitter", "turtle", "pal", "bully"] as const;
export type ArchetypeId = (typeof ARCHETYPES)[number];

// What the enemy telegraphs this turn. "idle" = nothing special (it will strike or do nothing harmful).
export const INTENTS = ["idle", "heavy", "guarding", "calm", "scared"] as const;
export type Intent = (typeof INTENTS)[number];

export const SIZES = ["smaller", "similar", "bigger"] as const;
export type Size = (typeof SIZES)[number];

export interface PetSpec {
  name: string;
  maxHp: number;
  atk: number;
  spd: number;
  size: number;
}

export const DEFAULT_PET: PetSpec = { name: "Mochi", maxHp: 30, atk: 7, spd: 5, size: 5 };

// Everything the Instinct (local model or rule policy) may look at when choosing a move.
export interface Observation {
  turn: number; // 1-based
  myHpPct: number;
  enemyHpPct: number;
  enemy: ArchetypeId;
  size: Size; // the enemy's size relative to the pet
  intent: Intent;
  last: Action | "none"; // the pet's previous move
}

export type EnemyAct = "strike" | "heavy" | "guard" | "idle" | "flee";

export type Outcome = "win" | "loss" | "fled" | "escaped" | "timeout";

export interface TurnRecord {
  obs: Observation;
  action: Action;
  enemyAct: EnemyAct;
  dealt: number; // damage the pet dealt
  taken: number; // damage the pet took
  myHp: number;
  enemyHp: number;
}

export interface Replay {
  enemy: ArchetypeId;
  seed: number;
  turns: TurnRecord[];
  outcome: Outcome;
  how: "ko" | "befriended" | "pet-ko" | "pet-fled" | "enemy-fled" | "timeout";
  myHpEnd: number;
  enemyHpEnd: number;
}

// Deterministic, synchronous policy: the unit the eval harness replays thousands of times.
export type Policy = (obs: Observation) => Action;
