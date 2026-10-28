import { ENEMIES, HEAVY_MULT, type EnemyDef } from "./enemies";
import { roll } from "./rng";
import {
  ARCHETYPES,
  DEFAULT_PET,
  type Action,
  type ArchetypeId,
  type EnemyAct,
  type Intent,
  type Observation,
  type PetSpec,
  type Policy,
  type Replay,
  type Size,
  type TurnRecord,
} from "./types";

export interface BattleConfig {
  enemy: ArchetypeId;
  seed: number;
  pet?: PetSpec;
  maxTurns?: number;
  enemyDef?: EnemyDef; // overrides ENEMIES[enemy], e.g. a ghost built from another player's memo
}

export const MAX_TURNS = 12;
const GUARD_FACTOR = 0.4;
const ENEMY_GUARD_FACTOR = 0.4;
const HURT_PCT = 40; // below this an enemy counts as hurt: it looks scared and befriend works far better

export const sizeOf = (enemy: number, pet: number): Size => (enemy >= pet + 2 ? "bigger" : enemy <= pet - 2 ? "smaller" : "similar");

const intentOf = (act: EnemyAct, def: EnemyDef, hpPct: number): Intent => {
  if (act === "heavy") return "heavy";
  if (act === "guard") return "guarding";
  if (act === "flee") return "scared";
  if (act === "idle") return "calm";
  return hpPct < HURT_PCT && def.id !== "brute" ? "scared" : "idle";
};

// One fight. observe() shows the pet what the enemy telegraphs this turn, step(action) resolves the turn.
// The synchronous and async runners below both drive this, so the live local-model path and the eval
// harness share exactly the same rules.
export class Battle {
  readonly pet: PetSpec;
  private readonly def: EnemyDef;
  private readonly seed: number; // luck stream: mixes the enemy in, so (brute, 5) and (pal, 5) do not share dice
  private readonly seedLabel: number;
  private readonly maxTurns: number;
  private myHp: number;
  private enemyHp: number;
  private turn = 1;
  private calm = 0;
  private last: Action | "none" = "none";
  private enemyAct: EnemyAct;
  private readonly turns: TurnRecord[] = [];
  private result: Pick<Replay, "outcome" | "how"> | null = null;

  constructor(cfg: BattleConfig) {
    this.pet = cfg.pet ?? DEFAULT_PET;
    this.def = cfg.enemyDef ?? ENEMIES[cfg.enemy];
    this.seedLabel = cfg.seed;
    this.seed = (cfg.seed ^ Math.imul(ARCHETYPES.indexOf(cfg.enemy) + 1, 0x9e3779b1)) | 0;
    this.maxTurns = cfg.maxTurns ?? MAX_TURNS;
    this.myHp = this.pet.maxHp;
    this.enemyHp = this.def.maxHp;
    this.enemyAct = this.chooseEnemyAct();
  }

  get done(): boolean {
    return this.result !== null;
  }

  observe(): Observation {
    const myHpPct = Math.round((100 * this.myHp) / this.pet.maxHp);
    const enemyHpPct = Math.round((100 * this.enemyHp) / this.def.maxHp);
    return {
      turn: this.turn,
      myHpPct,
      enemyHpPct,
      enemy: this.def.id,
      size: sizeOf(this.def.size, this.pet.size),
      intent: this.def.tell?.() ?? intentOf(this.enemyAct, this.def, enemyHpPct),
      last: this.last,
    };
  }

  step(action: Action): TurnRecord {
    if (this.result) throw new Error("battle is over");
    const obs = this.observe();
    const t = this.turn;
    const enemyAct = this.enemyAct;
    let dealt = 0;
    let taken = 0;
    let guarding = false;

    switch (action) {
      case "attack": {
        const raw = this.pet.atk * (0.85 + 0.3 * roll(this.seed, t, 1));
        dealt = Math.max(1, Math.round(enemyAct === "guard" ? raw * ENEMY_GUARD_FACTOR : raw));
        this.enemyHp = Math.max(0, this.enemyHp - dealt);
        break;
      }
      case "guard":
        guarding = true;
        break;
      case "emote":
        this.calm += 1;
        break;
      case "flee": {
        const p = Math.min(0.9, Math.max(0.1, 0.3 + 0.08 * (this.pet.spd - this.def.spd)));
        if (roll(this.seed, t, 3) < p) this.result = { outcome: "fled", how: "pet-fled" };
        break;
      }
      case "befriend": {
        const hpPct = (100 * this.enemyHp) / this.def.maxHp;
        const p = Math.min(0.95, this.def.befriendBase + 0.3 * this.calm + (hpPct < HURT_PCT ? 0.6 : 0));
        if (roll(this.seed, t, 4) < p) this.result = { outcome: "win", how: "befriended" };
        break;
      }
    }

    if (!this.result && this.enemyHp <= 0) this.result = { outcome: "win", how: "ko" };

    if (!this.result) {
      if (enemyAct === "strike" || enemyAct === "heavy") {
        const base = this.def.atk * (enemyAct === "heavy" ? HEAVY_MULT : 1) * (0.85 + 0.3 * roll(this.seed, t, 2));
        taken = Math.max(1, Math.round(guarding ? base * GUARD_FACTOR : base));
        this.myHp = Math.max(0, this.myHp - taken);
      } else if (enemyAct === "flee" && roll(this.seed, t, 5) < 0.5) {
        this.result = { outcome: "escaped", how: "enemy-fled" };
      }
      if (!this.result && this.myHp <= 0) this.result = { outcome: "loss", how: "pet-ko" };
    }

    const rec: TurnRecord = { obs, action, enemyAct, dealt, taken, myHp: this.myHp, enemyHp: this.enemyHp };
    this.turns.push(rec);
    this.last = action;
    this.turn += 1;
    if (!this.result && this.turn > this.maxTurns) this.result = { outcome: "timeout", how: "timeout" };
    if (!this.result) this.enemyAct = this.chooseEnemyAct();
    return rec;
  }

  replay(): Replay {
    if (!this.result) throw new Error("battle is not over");
    return {
      enemy: this.def.id,
      seed: this.seedLabel,
      turns: this.turns,
      ...this.result,
      myHpEnd: this.myHp,
      enemyHpEnd: this.enemyHp,
    };
  }

  private chooseEnemyAct(): EnemyAct {
    return this.def.act({
      seed: this.seed,
      turn: this.turn,
      enemyHpPct: (100 * this.enemyHp) / this.def.maxHp,
      myHpPct: (100 * this.myHp) / this.pet.maxHp,
      petLast: this.last,
      calm: this.calm,
    });
  }
}

export function runBattle(cfg: BattleConfig, policy: Policy): Replay {
  const b = new Battle(cfg);
  while (!b.done) b.step(policy(b.observe()));
  return b.replay();
}

// For the live path, where the Instinct is an async local-model call.
export async function runBattleAsync(cfg: BattleConfig, decide: (obs: Observation) => Promise<Action>): Promise<Replay> {
  const b = new Battle(cfg);
  while (!b.done) b.step(await decide(b.observe()));
  return b.replay();
}

export const isWin = (r: Replay): boolean => r.outcome === "win";
