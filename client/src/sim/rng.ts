// Stateless "luck": roll(seed, turn, channel) always returns the same number in [0, 1). Two policies that
// face the same seed therefore get the same luck on the same turn (common random numbers), which is
// what makes the before/after comparison paired and fair.
export function roll(seed: number, turn: number, channel: number): number {
  let h = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(turn + 1, 0x85ebca6b) ^ Math.imul(channel + 1, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Small seeded generator for the harness itself (bootstrap resampling, shuffles).
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
