// Walking rules shared by the avatar, the following pet and wandering creatures. Pure functions over
// plain {x, z} points, so they are tested without a scene.

export interface Vec {
  x: number;
  z: number;
}

export const WALK_SPEED = 4.2; // units per second
export const FOLLOW_GAP = 1.4; // the pet stops this close behind its player

// Move by (dx, dz) but never off the walkable area; slide along an edge when the full step is blocked.
export function slide(p: Vec, dx: number, dz: number, ok: (x: number, z: number) => boolean): Vec {
  if (ok(p.x + dx, p.z + dz)) return { x: p.x + dx, z: p.z + dz };
  if (dx && ok(p.x + dx, p.z)) return { x: p.x + dx, z: p.z };
  if (dz && ok(p.x, p.z + dz)) return { x: p.x, z: p.z + dz };
  return p;
}

// One step towards a target, never overshooting it.
export function stepToward(p: Vec, target: Vec, maxDist: number): { dx: number; dz: number; arrived: boolean } {
  const ddx = target.x - p.x;
  const ddz = target.z - p.z;
  const d = Math.hypot(ddx, ddz);
  if (d <= maxDist || d < 1e-6) return { dx: ddx, dz: ddz, arrived: true };
  return { dx: (ddx / d) * maxDist, dz: (ddz / d) * maxDist, arrived: false };
}

// Keyboard direction (WASD / arrows) to a unit step in world space. The camera looks from +z towards -z,
// so "up" walks away from the camera.
export function keyDir(keys: ReadonlySet<string>): Vec {
  let x = 0;
  let z = 0;
  if (keys.has("w") || keys.has("arrowup")) z -= 1;
  if (keys.has("s") || keys.has("arrowdown")) z += 1;
  if (keys.has("a") || keys.has("arrowleft")) x -= 1;
  if (keys.has("d") || keys.has("arrowright")) x += 1;
  const d = Math.hypot(x, z);
  return d ? { x: x / d, z: z / d } : { x: 0, z: 0 };
}

// The pet trails its player: it catches up faster the further behind it is, and waits when close.
// A walkable spot beside the leader, so a hop never lands in a wall.
export function hopTo(leader: Vec, ok: (x: number, z: number) => boolean): Vec {
  for (const [dx, dz] of [[0.8, 0.8], [-0.8, 0.8], [0.8, -0.8], [-0.8, -0.8]] as const) if (ok(leader.x + dx, leader.z + dz)) return { x: leader.x + dx, z: leader.z + dz };
  return { ...leader };
}

const STUCK_AFTER = 1.2; // seconds of pushing against something before the pet hops over

// Pushing against a wall gets nowhere, and walking would never free it: after a moment it hops to you.
export function unstick(before: Vec, after: Vec, leader: Vec, held: number, dt: number, ok: (x: number, z: number) => boolean): { pet: Vec; held: number } {
  const wants = Math.hypot(leader.x - after.x, leader.z - after.z) > FOLLOW_GAP + 0.3;
  const moved = Math.hypot(after.x - before.x, after.z - before.z);
  if (!wants || moved > WALK_SPEED * dt * 0.25) return { pet: after, held: 0 };
  return held + dt >= STUCK_AFTER ? { pet: hopTo(leader, ok), held: 0 } : { pet: after, held: held + dt };
}

export function followStep(pet: Vec, leader: Vec, dt: number, ok: (x: number, z: number) => boolean): Vec {
  const d = Math.hypot(leader.x - pet.x, leader.z - pet.z);
  if (d <= FOLLOW_GAP) return pet;
  if (d > 12) return hopTo(leader, ok); // left far behind (e.g. after a fight): hop over
  const speed = WALK_SPEED * Math.min(1.6, 0.6 + (d - FOLLOW_GAP) / 2);
  const s = stepToward(pet, leader, Math.min(speed * dt, d - FOLLOW_GAP));
  return slide(pet, s.dx, s.dz, ok);
}
