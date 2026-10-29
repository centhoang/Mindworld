import { addCoins } from "./shop";

// The farm beside your A-frame: 6 beds (3x2). Plant a seed, water it, and after the crop's grow time it
// moves one stage (seed -> sprout -> leafy -> ripe) and is dry again, so each stage needs one watering.
// Ripe crops go to the basket and sell at the market. Pure rules on plain data; time is passed in (ms),
// so growth keeps going while the tab is closed and tests need no clock.

export const CROPS = {
  turnip: { seed: 1, sell: 3, growMs: 45_000 },
  carrot: { seed: 2, sell: 6, growMs: 90_000 },
  berry: { seed: 4, sell: 12, growMs: 180_000 },
} as const;
export type CropId = keyof typeof CROPS;
export const CROP_IDS = Object.keys(CROPS) as CropId[];
export const PLOTS = 6;
export const RIPE = 3;
export const MAX_STACK = 99;

export interface Plot {
  crop: CropId | null;
  stage: number; // 0 seed .. 3 ripe
  wetUntil: number; // ms when the current watering finishes the next stage; 0 = dry
}

export type Bag = Partial<Record<CropId, number>>;

export interface Farm {
  plots: Plot[];
  seeds: Bag;
  basket: Bag;
}

const EMPTY_PLOT: Plot = { crop: null, stage: 0, wetUntil: 0 };

export const emptyFarm = (): Farm => ({ plots: Array.from({ length: PLOTS }, () => ({ ...EMPTY_PLOT })), seeds: { turnip: 3 }, basket: {} });

export type FarmResult = { ok: true; farm: Farm } | { ok: false; reason: "plot" | "busy" | "empty" | "no-seed" | "ripe" | "wet" | "not-ripe" };

const withPlot = (f: Farm, i: number, p: Plot): Farm => ({ ...f, plots: f.plots.map((q, j) => (j === i ? p : q)) });
const bump = (b: Bag, c: CropId, n: number): Bag => {
  const v = Math.max(0, Math.min(MAX_STACK, (b[c] ?? 0) + n));
  const out = { ...b };
  if (v) out[c] = v;
  else delete out[c];
  return out;
};
const plotOk = (f: Farm, i: number) => Number.isInteger(i) && i >= 0 && i < f.plots.length;

export function plant(f: Farm, i: number, crop: CropId): FarmResult {
  if (!plotOk(f, i) || !(crop in CROPS)) return { ok: false, reason: "plot" };
  if (f.plots[i]!.crop) return { ok: false, reason: "busy" };
  if (!f.seeds[crop]) return { ok: false, reason: "no-seed" };
  return { ok: true, farm: { ...withPlot(f, i, { crop, stage: 0, wetUntil: 0 }), seeds: bump(f.seeds, crop, -1) } };
}

export function water(f: Farm, i: number, now: number): FarmResult {
  if (!plotOk(f, i)) return { ok: false, reason: "plot" };
  const p = f.plots[i]!;
  if (!p.crop) return { ok: false, reason: "empty" };
  if (p.stage >= RIPE) return { ok: false, reason: "ripe" };
  if (p.wetUntil) return { ok: false, reason: "wet" };
  return { ok: true, farm: withPlot(f, i, { ...p, wetUntil: now + CROPS[p.crop].growMs }) };
}

// Advances every watered bed whose time is up by one stage; a bed never skips stages, however long ago.
export function tick(f: Farm, now: number): Farm {
  let changed = false;
  const plots = f.plots.map((p) => {
    if (!p.crop || !p.wetUntil || now < p.wetUntil) return p;
    changed = true;
    return { ...p, stage: Math.min(RIPE, p.stage + 1), wetUntil: 0 };
  });
  return changed ? { ...f, plots } : f;
}

export function harvest(f: Farm, i: number): FarmResult {
  if (!plotOk(f, i)) return { ok: false, reason: "plot" };
  const p = f.plots[i]!;
  if (!p.crop) return { ok: false, reason: "empty" };
  if (p.stage < RIPE) return { ok: false, reason: "not-ripe" };
  return { ok: true, farm: { ...withPlot(f, i, { ...EMPTY_PLOT }), basket: bump(f.basket, p.crop, 1) } };
}

// Sells the whole basket at the market.
export function sellAll(f: Farm, coins: number): { farm: Farm; coins: number; earned: number } {
  const earned = CROP_IDS.reduce((s, c) => s + (f.basket[c] ?? 0) * CROPS[c].sell, 0);
  return { farm: { ...f, basket: {} }, coins: addCoins(coins, earned), earned };
}

export type SeedResult = { ok: true; farm: Farm; coins: number } | { ok: false; reason: "unknown" | "poor" | "full" };

export function buySeeds(f: Farm, coins: number, crop: CropId, n = 1): SeedResult {
  if (!(crop in CROPS) || !Number.isInteger(n) || n < 1) return { ok: false, reason: "unknown" };
  const cost = CROPS[crop].seed * n;
  if (coins < cost) return { ok: false, reason: "poor" };
  if ((f.seeds[crop] ?? 0) + n > MAX_STACK) return { ok: false, reason: "full" };
  return { ok: true, farm: { ...f, seeds: bump(f.seeds, crop, n) }, coins: coins - cost };
}

// What the bed shows: a sprite stage, or "dry" when it needs watering. Ripe beds need nothing.
export const needsWater = (p: Plot): boolean => p.crop !== null && p.stage < RIPE && !p.wetUntil;

// Saved data. Never throws; anything odd becomes an empty bed / zero count.
export function parseFarm(raw: unknown): Farm {
  const f = emptyFarm();
  if (!raw || typeof raw !== "object") return f;
  const r = raw as { plots?: unknown; seeds?: unknown; basket?: unknown };
  const bag = (v: unknown): Bag => {
    const out: Bag = {};
    if (v && typeof v === "object")
      for (const c of CROP_IDS) {
        const n = (v as Record<string, unknown>)[c];
        if (typeof n === "number" && Number.isFinite(n) && n >= 1) out[c] = Math.min(MAX_STACK, Math.floor(n));
      }
    return out;
  };
  const plots = f.plots.map((empty, i) => {
    const p = Array.isArray(r.plots) ? (r.plots[i] as Partial<Plot> | undefined) : undefined;
    if (!p || typeof p !== "object" || typeof p.crop !== "string" || !(p.crop in CROPS)) return empty;
    const stage = typeof p.stage === "number" && Number.isFinite(p.stage) ? Math.max(0, Math.min(RIPE, Math.floor(p.stage))) : 0;
    const wetUntil = typeof p.wetUntil === "number" && Number.isFinite(p.wetUntil) && p.wetUntil > 0 && stage < RIPE ? p.wetUntil : 0;
    return { crop: p.crop as CropId, stage, wetUntil };
  });
  return { plots, seeds: "seeds" in r ? bag(r.seeds) : f.seeds, basket: bag(r.basket) };
}
