import { sizeOf } from "./battle";
import type { EnemyCtx, EnemyDef } from "./enemies";
import { ruleMatches, type Memo } from "./memo";
import { DEFAULT_PET, type Action, type ArchetypeId, type EnemyAct, type Intent, type Observation, type PetSpec } from "./types";

// The Reader: a boss that reads the pet's memo. Each turn it plans a move, works out which memo rule
// that move's tell would trigger, and if one fires it keeps the tell but does the counter instead (a
// feint). Reading costs focus; when focus runs out it is dazed for a turn and shows it ("calm"), and
// that turn it cannot read. So obvious rules get punished, and a pet that is taught to use the daze wins.
// Boss fights stay out of the paired eval and out of what the coach reviews (see main.ts).

// The pet sees the boss as the patternless archetype, like a ghost, so "when the enemy is a brute" never fires.
export const BOSS_ARCHETYPE: ArchetypeId = "bully";
export const BOSS_TURNS = 16;
export const BOSS_FOCUS = 2; // reads before it is dazed
export const BOSS_DAZED_BEFRIEND = 0.5; // a dazed boss is open to friendship
const HURT_PCT = 40;

export const BOSS_STATS = { label: "The Reader", maxHp: 50, atk: 5, spd: 3, size: 9 } as const;

// What answers each move the memo would make: a hidden heavy hit, or a pause when the pet would guard (it wastes its turn).
export const COUNTER: Record<Action, EnemyAct> = { attack: "heavy", guard: "idle", emote: "heavy", befriend: "heavy", flee: "heavy" };

export interface BossRead {
  turn: number;
  rule: number; // index of the memo rule it read
  feint: Intent; // the tell it showed
  did: EnemyAct; // what it did instead
}

export interface Boss {
  def: EnemyDef;
  reads: BossRead[]; // filled in as the fight runs; the UI shows them
  dazedTurns: number[];
}

const plannedAct = (turn: number): EnemyAct => (turn % 3 === 0 ? "heavy" : "strike");
const truthfulTell = (act: EnemyAct, hpPct: number): Intent =>
  act === "heavy" ? "heavy" : act === "guard" ? "guarding" : act === "idle" ? "calm" : hpPct < HURT_PCT ? "scared" : "idle";

// The pet's observation as the boss predicts it, mirroring Battle.observe().
function petView(c: EnemyCtx, intent: Intent, size: Observation["size"]): Observation {
  return { turn: c.turn, myHpPct: Math.round(c.myHpPct), enemyHpPct: Math.round(c.enemyHpPct), enemy: BOSS_ARCHETYPE, size, intent, last: c.petLast };
}

// Builds a fresh boss for one fight (it keeps focus and reads between turns).
export function makeBoss(memo: Memo, pet: PetSpec = DEFAULT_PET): Boss {
  const size = sizeOf(BOSS_STATS.size, pet.size);
  const reads: BossRead[] = [];
  const dazedTurns: number[] = [];
  let focus = BOSS_FOCUS;
  let dazedNext = false;
  let shown: Intent | undefined;
  let dazed = false;
  const def: EnemyDef = {
    id: BOSS_ARCHETYPE,
    label: BOSS_STATS.label,
    maxHp: BOSS_STATS.maxHp,
    atk: BOSS_STATS.atk,
    spd: BOSS_STATS.spd,
    size: BOSS_STATS.size,
    get befriendBase() {
      return dazed ? BOSS_DAZED_BEFRIEND : 0;
    },
    tell: () => shown,
    act: (c) => {
      shown = undefined;
      dazed = dazedNext;
      if (dazedNext) {
        dazedNext = false;
        focus = BOSS_FOCUS;
        dazedTurns.push(c.turn);
        return "idle";
      }
      const planned = plannedAct(c.turn);
      const feint = truthfulTell(planned, c.enemyHpPct);
      const rule = memo.rules.findIndex((r) => ruleMatches(r, petView(c, feint, size)));
      if (rule < 0 || focus === 0) return planned;
      focus -= 1;
      if (focus === 0) dazedNext = true;
      const did = COUNTER[memo.rules[rule]!.do];
      if (did !== planned) shown = feint;
      reads.push({ turn: c.turn, rule, feint, did });
      return did;
    },
  };
  return { def, reads, dazedTurns };
}
