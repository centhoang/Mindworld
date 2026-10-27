import { comparePaired, makeScenarios, seedRange, type PairedResult } from "./evaluate";
import type { Memo } from "./memo";
import { baselinePolicy, memoPolicy } from "./policy";
import { ARCHETYPES, type ArchetypeId, type Replay } from "./types";

// Teach -> Prove: the same seeded fights replayed with the memo before and after the change, side by side.
// "train" fights are the ones the coach may have seen; "heldout" uses fresh seeds and every archetype,
// including ones the coach never saw, so the improvement cannot be memorized.

export const TRAIN_SEEDS = seedRange(1, 40);
export const HELDOUT_SEEDS = seedRange(1000, 200);

export interface ProofReport {
  train: PairedResult;
  heldout: PairedResult;
  showcase: { enemy: ArchetypeId; seed: number; before: Replay; after: Replay } | null;
}

export function prove(memoBefore: Memo | null, memoAfter: Memo, enemies: readonly ArchetypeId[] = ARCHETYPES): ProofReport {
  const before = memoBefore ? memoPolicy(memoBefore) : baselinePolicy;
  const after = memoPolicy(memoAfter);
  const train = comparePaired(before, after, makeScenarios(enemies, TRAIN_SEEDS));
  const heldout = comparePaired(before, after, makeScenarios(enemies, HELDOUT_SEEDS));
  const flip = heldout.flips[0];
  return {
    train,
    heldout,
    showcase: flip ? { enemy: flip.scenario.enemy, seed: flip.scenario.seed, before: flip.before, after: flip.after } : null,
  };
}

// A coach's revision (Reflect) is adopted only if it does not lose on the practice seeds: model replies vary
// from run to run, and a free simulation catches a bad one before the pet uses it. Held-out seeds stay
// untouched, so the reported proof is still on fights the gate never looked at. Teach is not gated: it
// carries out what the player asked for.
export function passesGate(before: Memo, after: Memo): boolean {
  return comparePaired(memoPolicy(before), memoPolicy(after), makeScenarios(ARCHETYPES, TRAIN_SEEDS)).winRateDelta >= 0;
}
