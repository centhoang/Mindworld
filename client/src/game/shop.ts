import { isKind, type DecorKind } from "./home";

// Coins and the market stall. Wild wins pay a little, befriending pays more; coins buy decor that is
// not in the free starter set. Pure rules; main.ts keeps coins and bought items in the save.

export const PRICES: Partial<Record<DecorKind, number>> = { sunflower: 6, pond: 10, birdhouse: 14 };
export const SHOP_ITEMS = Object.keys(PRICES) as DecorKind[];
export const MAX_COINS = 9999;

export function coinsFor(outcome: string, how?: string): number {
  if (outcome !== "win") return 0;
  return how === "befriended" ? 5 : 3;
}

export const addCoins = (coins: number, n: number): number => Math.max(0, Math.min(MAX_COINS, Math.floor(coins) + Math.floor(n)));

export type BuyResult = { ok: true; coins: number; owned: DecorKind[] } | { ok: false; reason: "unknown" | "owned" | "poor" };

export function buy(coins: number, owned: readonly DecorKind[], item: DecorKind): BuyResult {
  const price = PRICES[item];
  if (price === undefined) return { ok: false, reason: "unknown" };
  if (owned.includes(item)) return { ok: false, reason: "owned" };
  if (coins < price) return { ok: false, reason: "poor" };
  return { ok: true, coins: coins - price, owned: [...owned, item] };
}

// Saved data: a coin count and the list of bought items. Never throws.
export function parseCoins(raw: unknown): number {
  return typeof raw === "number" && Number.isFinite(raw) ? addCoins(0, raw) : 0;
}
export function parseOwned(raw: unknown): DecorKind[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((k): k is DecorKind => isKind(k) && PRICES[k as DecorKind] !== undefined))];
}
