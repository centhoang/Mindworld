import { PRICES } from "./shop";
import { DECOR, emptyHome, HOME_SLOTS, isKind, parseHome, type DecorKind, type Slot } from "./home";

// Decor of a player's corner: items placed on named slots, 8 around the plot (the ring that home.ts
// already draws and ghosts already carry) plus 4 on the A-frame's porch. Pure data + rules; main.ts
// saves it, the world view draws it. The plot part is still exposed as the old 8-slot array, so battle
// plots and shared ghosts keep working unchanged.

export const PORCH_SLOTS = 4;
export const MAX_PLACED = HOME_SLOTS + PORCH_SLOTS;

export type SlotId = `plot-${number}` | `porch-${number}`;
export interface Placement {
  item: DecorKind;
  slot: SlotId;
}

// Everything not sold at the market is free; bought items (shop.ts) are passed in as extra.
export const STARTER_SET: readonly DecorKind[] = DECOR.filter((k) => PRICES[k] === undefined);
export const ownedItems = (extra: readonly DecorKind[] = []): DecorKind[] => [...new Set([...STARTER_SET, ...extra])];

export const plotSlot = (i: number): SlotId => `plot-${i}`;
export const porchSlot = (i: number): SlotId => `porch-${i}`;

export function isSlotId(v: unknown): v is SlotId {
  if (typeof v !== "string") return false;
  const m = /^(plot|porch)-(\d{1,2})$/.exec(v);
  if (!m) return false;
  const n = Number(m[2]);
  return n < (m[1] === "plot" ? HOME_SLOTS : PORCH_SLOTS);
}

export const itemAt = (list: readonly Placement[], slot: SlotId): DecorKind | null => list.find((p) => p.slot === slot)?.item ?? null;

// Puts an item on a slot (replacing whatever was there). Unknown items/slots, or items the player does
// not own, leave the list as it was. Returns a new list.
export function place(list: readonly Placement[], item: DecorKind, slot: SlotId, owned: readonly DecorKind[] = STARTER_SET): Placement[] {
  const next = parseDecor(list);
  if (!isKind(item) || !isSlotId(slot) || !owned.includes(item)) return next;
  const out = next.filter((p) => p.slot !== slot);
  if (out.length >= MAX_PLACED) return next;
  out.push({ item, slot });
  return out;
}

export function remove(list: readonly Placement[], slot: SlotId): Placement[] {
  return parseDecor(list).filter((p) => p.slot !== slot);
}

// The decorate buttons cycle a slot: empty -> each owned item -> empty.
export function cycle(list: readonly Placement[], slot: SlotId, owned: readonly DecorKind[] = STARTER_SET): Placement[] {
  const cur = itemAt(list, slot);
  const at = cur === null ? -1 : owned.indexOf(cur);
  const nextItem = owned[at + 1];
  return nextItem ? place(list, nextItem, slot, owned) : remove(list, slot);
}

// Accepts saved data from any version: bad entries are dropped, the first item on a slot wins. Never throws.
export function parseDecor(raw: unknown): Placement[] {
  if (!Array.isArray(raw)) return [];
  const out: Placement[] = [];
  for (const r of raw) {
    if (out.length >= MAX_PLACED) break;
    if (!r || typeof r !== "object") continue;
    const { item, slot } = r as Record<string, unknown>;
    if (isKind(item) && isSlotId(slot) && !out.some((p) => p.slot === slot)) out.push({ item, slot });
  }
  return out;
}

// Older saves only had the 8 plot slots.
export function fromHome(home: unknown, porch: unknown = []): Placement[] {
  const out: Placement[] = [];
  parseHome(home).forEach((k, i) => k && out.push({ item: k, slot: plotSlot(i) }));
  parsePorch(porch).forEach((k, i) => k && out.push({ item: k, slot: porchSlot(i) }));
  return out;
}

export function plotSlots(list: readonly Placement[]): Slot[] {
  const out = emptyHome();
  for (const p of parseDecor(list)) if (p.slot.startsWith("plot-")) out[Number(p.slot.slice(5))] = p.item;
  return out;
}

export function porchSlots(list: readonly Placement[]): Slot[] {
  const out = Array<Slot>(PORCH_SLOTS).fill(null);
  for (const p of parseDecor(list)) if (p.slot.startsWith("porch-")) out[Number(p.slot.slice(6))] = p.item;
  return out;
}

// A ghost's porch list (optional; older ghosts and the server have none). Never throws.
export function parsePorch(raw: unknown): Slot[] {
  const out = Array<Slot>(PORCH_SLOTS).fill(null);
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < PORCH_SLOTS; i++) out[i] = isKind(raw[i]) ? raw[i] : null;
  return out;
}
