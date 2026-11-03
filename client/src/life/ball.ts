// The village ball: one for everybody. Its whole state is the last kick (where the ball was and how fast it left);
// where it is now follows from that kick in fixed steps, so every machine fed the same kicks sees the same ball.
// The room numbers the kicks: a machine shows its own kick at once and keeps the room's order after that.

import type { Vec } from "../world/movement";

export interface Kick {
  x: number;
  z: number;
  vx: number;
  vz: number;
  by: string; // who kicked it: a live id, an NPC id or "me"
}

export interface Pitch {
  spot: Vec; // where the ball waits
  goal: Vec; // the goal mouth's centre; a goal counts going in from the south (north-going ball)
}

export interface BallNow {
  x: number;
  z: number;
  moving: boolean;
  goal: boolean; // sitting in the net
  by: string | null;
}

export const BALL_STEP = 1 / 30;
export const KICK_MAX = 9; // tiles a second
export const TOUCH = 0.55; // feet this close to the ball kick it
export const KICK_GAP = 0.35; // seconds after a kick before anyone may kick again
const DECEL = 1.6; // tiles/s² rolling loss
const DRAG = 0.3; // and a share of the speed per second
const BOUNCE = 0.5; // speed kept off a wall
const REST = 0.06;
const GOAL_RESET = 2.5; // seconds in the net before the ball is back on its spot
export const PITCH_R = 14; // a ball resting further than this from its spot is lost...
const LOST_RESET = 40; // ...and comes back after this long
const MAX_STEPS = 6000;

const r2 = (v: number) => Math.round(v * 100) / 100;

// What the room keeps and sends: two decimals, speed capped. Apply mine in the same form, so its echo matches.
export function cleanKick(k: Kick): Kick {
  const s = Math.hypot(k.vx, k.vz);
  const f = s > KICK_MAX ? KICK_MAX / s : 1;
  return { x: r2(k.x), z: r2(k.z), vx: r2(k.vx * f), vz: r2(k.vz * f), by: k.by };
}

export function inGoal(p: Pitch, x: number, z: number): boolean {
  return Math.abs(x - p.goal.x) < 0.75 && z < p.goal.z + 0.25 && z > p.goal.z - 0.9;
}

// A kick from `from` toward `to` at `speed`, turned by `turn` radians (a miss).
export function aim(from: Vec, to: Vec, speed: number, turn = 0): { vx: number; vz: number } {
  let dx = to.x - from.x, dz = to.z - from.z;
  const d = Math.hypot(dx, dz) || 1;
  [dx, dz] = [dx / d, dz / d];
  const [c, s] = [Math.cos(turn), Math.sin(turn)];
  return { vx: (dx * c - dz * s) * speed, vz: (dx * s + dz * c) * speed };
}

export class Ball {
  seq = 0; // the room's number of the last kick shown (0 = none yet)
  kickedAt = -Infinity; // caller's clock (seconds) of the last kick
  private kick: Kick | null = null;
  private pending: Kick | null = null; // my own kick, shown before the room confirms it
  private x: number;
  private z: number;
  private vx = 0;
  private vz = 0;
  private t = 0; // seconds of roll simulated since the kick
  private still = true;
  private goalT: number | null = null;
  private restT: number | null = null;

  constructor(public pitch: Pitch, private readonly canWalk: (x: number, z: number) => boolean) {
    this.x = pitch.spot.x;
    this.z = pitch.spot.z;
  }

  // A kick from the room (`seq` above the last one), or my own (no `seq`: shown now, confirmed by its echo).
  // `at` = when it was kicked, on the caller's clock. Returns whether the ball changed.
  apply(k: Kick, at: number, seq?: number): boolean {
    const c = cleanKick(k);
    if (seq !== undefined) {
      if (seq <= this.seq) return false;
      this.seq = seq;
      const p = this.pending;
      this.pending = null;
      if (p && this.kick === p && p.x === c.x && p.z === c.z && p.vx === c.vx && p.vz === c.vz) return false; // my kick, already rolling
    } else this.pending = c;
    this.kick = c;
    this.kickedAt = at;
    Object.assign(this, { x: c.x, z: c.z, vx: c.vx, vz: c.vz, t: 0, still: false, goalT: null, restT: null });
    return true;
  }

  // Back on its spot at rest (a new layout, or nobody has kicked it yet).
  home(): void {
    Object.assign(this, { x: this.pitch.spot.x, z: this.pitch.spot.z, vx: 0, vz: 0, still: true, goalT: null, restT: null });
  }

  now(at: number): BallNow {
    const target = at - this.kickedAt;
    for (let n = 0; !this.still && this.t + BALL_STEP <= target && n < MAX_STEPS; n++) this.step();
    if (this.goalT !== null && target >= this.goalT + GOAL_RESET) this.home();
    if (this.restT !== null && target >= this.restT + LOST_RESET) this.home();
    return { x: this.x, z: this.z, moving: !this.still, goal: this.goalT !== null, by: this.kick?.by ?? null };
  }

  private step(): void {
    this.t += BALL_STEP;
    const sp = Math.hypot(this.vx, this.vz);
    const ns = Math.max(0, sp - (DECEL + DRAG * sp) * BALL_STEP);
    if (ns < REST) {
      this.vx = this.vz = 0;
      this.still = true;
      if (Math.hypot(this.x - this.pitch.spot.x, this.z - this.pitch.spot.z) > PITCH_R) this.restT = this.t;
      return;
    }
    this.vx *= ns / sp;
    this.vz *= ns / sp;
    let nx = this.x + this.vx * BALL_STEP;
    if (!this.canWalk(nx, this.z)) {
      this.vx = -this.vx * BOUNCE;
      nx = this.x;
    }
    let nz = this.z + this.vz * BALL_STEP;
    if (!this.canWalk(nx, nz)) {
      this.vz = -this.vz * BOUNCE;
      nz = this.z;
    }
    this.x = nx;
    this.z = nz;
    if (this.vz < 0 && inGoal(this.pitch, nx, nz)) {
      this.vx = this.vz = 0;
      this.still = true;
      this.goalT = this.t;
    }
  }
}
