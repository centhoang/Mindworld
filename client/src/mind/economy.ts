// The town's money. Villagers earn goods from their work and garden, sell them at the end of the market shift,
// and pick what to plant from the prices on the town board. Prices move only through real trades and real wants.
// A deal with a player stays inside bounds worked out here; a model can only choose among them. Pure: no world state.

import type { LmRequest } from "./brain";
import { GRUDGE_TRUST, holdsGrudge, hurt, toYou, type Bond } from "./bonds";
import { dealLimit, refusesDeal } from "./jobs";
import { personaCard, type Persona } from "./persona";

export const GOODS = { wheat: 3, carrot: 6, tomato: 12, fish: 7, wood: 5, herbs: 8 } as const;
export type Good = keyof typeof GOODS;
export const GOOD_IDS = Object.keys(GOODS) as Good[];
const isGood = (g: string): g is Good => g in GOODS;

export const CROPS_GROWN: readonly Good[] = ["wheat", "carrot", "tomato"];
export const JOB_GOOD: Partial<Record<string, Good>> = { fish: "fish", chop: "wood", tend: "herbs" };
const SEED: Partial<Record<Good, number>> = { wheat: 1, carrot: 2, tomato: 4 };
export const WORK_YIELD = 2;
export const HARVEST_YIELD = 3;
export const GROW_STEPS = 2; // garden sessions from seed to harvest
const SOLD_STEP = 0.08; // each unit that came to market this cycle
const WANT_STEP = 0.3; // each villager after the good today
const TRADES_MAX = 6;

export interface Purse {
  coins: number;
  goods: Partial<Record<Good, number>>;
  crop: Good | null;
  grown: number; // garden sessions on this crop
  goals?: number; // long goals reached so far (goals.ts)
}

export const newPurse = (): Purse => ({ coins: 15, goods: {}, crop: null, grown: 0 });

export interface Trade {
  who: string;
  good: Good;
  qty: number; // units that reached the market; negative = taken from it
  price: number;
}

export interface Market {
  day: number;
  sold: Partial<Record<Good, number>>;
  wanted: Partial<Record<Good, string[]>>; // who is after it today
  trades: Trade[]; // newest last
}

export const newMarket = (): Market => ({ day: -1, sold: {}, wanted: {}, trades: [] });

// Stable across machines, like a skipped shift: everyone sees the same wants on the same day.
const roll = (id: string, day: number): number => [...id].reduce((s, c) => s + c.charCodeAt(0), day * 5);

export function wantOf(p: Persona, day: number): Good | null {
  const likes = (p.likes ?? []).filter(isGood);
  return likes.length ? likes[roll(p.id, day) % likes.length]! : null;
}

// A new day: last cycle's glut fades by half and the villagers want something new.
export function openDay(m: Market, day: number, people: readonly Persona[]): void {
  if (m.day === day) return;
  m.day = day;
  for (const g of GOOD_IDS) {
    const left = Math.trunc((m.sold[g] ?? 0) / 2);
    if (left) m.sold[g] = left;
    else delete m.sold[g];
  }
  m.wanted = {};
  for (const p of people) {
    const g = wantOf(p, day);
    if (g) (m.wanted[g] ??= []).push(p.name);
  }
}

export function priceOf(m: Market, g: Good): number {
  const base = GOODS[g];
  const swing = 1 + (m.wanted[g]?.length ?? 0) * WANT_STEP - (m.sold[g] ?? 0) * SOLD_STEP;
  return Math.max(1, Math.round(base * Math.max(0.5, Math.min(2, swing))));
}

export function record(m: Market, t: Trade): void {
  m.sold[t.good] = Math.max(0, (m.sold[t.good] ?? 0) + t.qty);
  m.trades = [...m.trades, t].slice(-TRADES_MAX);
}

// The other machines hear of trades as room lines, so every board shows the same town.
export const tradeLine = (t: Trade): string => `trade|${t.who}|${t.good}|${t.qty}|${t.price}`;
export function parseTradeLine(l: string): Trade | null {
  const [tag, who, good, qty, price] = l.split("|");
  if (tag !== "trade" || !who || !good || !isGood(good)) return null;
  const q = Number(qty), c = Number(price);
  return Number.isFinite(q) && Number.isFinite(c) ? { who, good, qty: q, price: c } : null;
}

export const add = (p: Purse, g: Good, n: number): void => {
  const v = Math.max(0, (p.goods[g] ?? 0) + n);
  if (v) p.goods[g] = v;
  else delete p.goods[g];
};

// A villager with an empty bed reads the board: the best margin it can pay the seed for.
export function bestCrop(m: Market, coins: number): { good: Good; why: string } | null {
  const can = CROPS_GROWN.filter((g) => (SEED[g] ?? 0) <= coins);
  if (!can.length) return null;
  const good = can.reduce((a, b) => (HARVEST_YIELD * priceOf(m, b) - SEED[b]! > HARVEST_YIELD * priceOf(m, a) - SEED[a]! ? b : a));
  return { good, why: `${good} at ${priceOf(m, good)}c on the board > plant ${good}` };
}

export function plantCrop(p: Purse, g: Good): void {
  p.coins = Math.max(0, p.coins - (SEED[g] ?? 0));
  p.crop = g;
  p.grown = 0;
}

// The end of the market shift: each villager sells what it does not keep for itself. The price falls with each unit.
export function sellStock(m: Market, p: Purse, person: Persona): Trade[] {
  const out: Trade[] = [];
  for (const g of GOOD_IDS) {
    const keep = (person.likes ?? []).includes(g) ? 1 : 0;
    const qty = (p.goods[g] ?? 0) - keep;
    if (qty <= 0) continue;
    let coins = 0;
    for (let i = 0; i < qty; i++) {
      coins += priceOf(m, g);
      m.sold[g] = (m.sold[g] ?? 0) + 1;
    }
    m.sold[g]! -= qty; // `record` counts them once
    p.coins += coins;
    add(p, g, -qty);
    const t = { who: person.name, good: g, qty, price: Math.round(coins / qty) };
    record(m, t);
    out.push(t);
  }
  return out;
}

export const purseLine = (who: Purse): string => `purse|${who.coins}|${who.crop ?? ""}|${who.grown}|${GOOD_IDS.filter((g) => who.goods[g]).map((g) => `${g}:${who.goods[g]}`).join(",")}|${who.goals ?? 0}`;
export function parsePurseLine(l: string): Purse | null {
  const [tag, coins, crop, grown, goods, goals] = l.split("|");
  if (tag !== "purse") return null;
  const p = newPurse();
  p.coins = Number(coins) || 0;
  p.crop = crop && isGood(crop) ? crop : null;
  p.grown = Number(grown) || 0;
  if (Number(goals) > 0) p.goals = Number(goals);
  for (const part of (goods ?? "").split(",")) {
    const [g, n] = part.split(":");
    if (g && isGood(g) && Number(n) > 0) p.goods[g] = Number(n);
  }
  return p;
}

export const purseText = (p: Purse): string => [`${p.coins}c`, ...GOOD_IDS.filter((g) => p.goods[g]).map((g) => `${p.goods[g]} ${g}`), ...(p.crop ? [`growing ${p.crop}`] : [])].join(", ");

// ---- deals with a player, in their own words

export type OfferKind = "gift" | "sell" | "buy"; // the player gives, sells to the NPC, or buys from it

export interface Offer {
  kind: OfferKind;
  good: Good;
  qty: number;
  price: number | null; // each, when the player named one
}

const GOOD_WORD = /\b(wheat|carrots?|tomato(?:e?s)?|fish|wood|herbs?)\b/i;
const WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5 };

export function parseOffer(line: string): Offer | null {
  const l = line.toLowerCase();
  const g = GOOD_WORD.exec(l);
  if (!g) return null;
  const good = (g[1]!.startsWith("tomato") ? "tomato" : g[1]!.startsWith("herb") ? "herbs" : g[1]!.replace(/s$/, "")) as Good;
  const before = l.slice(0, g.index).trim().split(/\s+/).at(-1) ?? "";
  const qty = Math.min(9, Number(before) || WORDS[before] || 1);
  const asked = /\bfor (\d+)|\b(\d+) ?(?:c|coins?)\b/.exec(l);
  const price = asked ? Math.round(Number(asked[1] ?? asked[2]) / (/\beach\b/.test(l) ? 1 : qty)) : null;
  const kind: OfferKind | null =
    /\b(sell me|give me|can i (?:have|get|buy)|i(?:'ll| will) take|i want|i'?d like|could i (?:have|get|buy))\b/.test(l) ? "buy"
    : /\b(buy (?:my|this|these|some of my)|want to buy|sell|selling)\b/.test(l) ? "sell"
    : /\bbuy\b/.test(l) ? "buy"
    : /\b(gift|give|gave|brought|bring|here'?s|for you|take this|take these|have this|have these|have some)\b/.test(l) ? "gift"
    : null;
  return kind ? { kind, good, qty, price } : null;
}

export type DealAnswer = "accept" | "counter" | "refuse";

export interface Verdict {
  answer: DealAnswer;
  fixed: boolean; // true: the facts settle it, no opinion needed
  price: number; // each
  why: string; // for the player and the inspector
}

const no = (why: string): Verdict => ({ answer: "refuse", fixed: true, price: 0, why });

// `pay` is what the player can spend and `stock` what they hold of the good. `saving`: what the NPC keeps its coins
// for, and how many it can spare.
export function judge(p: Persona, b: Bond | undefined, purse: Purse, m: Market, o: Offer, who: string, pay: number, stock: number, saving?: { what: string; spare: number }): Verdict {
  const sore = b && hurt(b);
  const fond = (b?.fondness ?? 0) / 200; // up to half the price either way
  if (o.kind !== "buy" && stock < o.qty) return no(`You don't have ${o.qty} ${o.good}, ${who}.`);
  if (o.kind === "gift") {
    if (holdsGrudge(b)) return no(`Keep your ${o.good}, ${who}.${sore ? ` Last time, ${toYou(sore.text, who)}.` : ""}`);
    return { answer: "accept", fixed: true, price: 0, why: "" };
  }
  if (refusesDeal(p, b)) return no(`Not today, ${who}.${sore ? ` Last time, ${toYou(sore.text, who)}.` : ""}`);
  const fair = priceOf(m, o.good);
  if (o.kind === "sell") {
    const after = m.wanted[o.good]?.includes(p.name) || (p.likes ?? []).includes(o.good) || p.job?.act === "sell";
    if (!after) return no(`I have no use for ${o.good}, ${who}.`);
    const top = Math.max(1, Math.ceil(fair * (1 + fond)));
    const ask = o.price ?? fair;
    const each = Math.min(ask, top);
    if (each * o.qty > purse.coins) return no(`I only have ${purse.coins} coins, ${who}.`);
    if (saving && each * o.qty > saving.spare) return no(`I am saving for ${saving.what}, ${who}. I can spare ${saving.spare} coins.`);
    if (ask <= top) return { answer: "accept", fixed: false, price: each, why: `${o.good} is ${fair}c on the board` };
    return ask <= top * 1.5 ? { answer: "counter", fixed: false, price: top, why: `${ask}c is over the board's ${fair}c` } : no(`${ask} coins? Not for ${o.good}, ${who}. The board says ${fair}.`);
  }
  if ((purse.goods[o.good] ?? 0) < o.qty) return no(`I don't have ${o.qty === 1 ? "any" : o.qty} ${o.good} to sell, ${who}.`);
  const least = Math.max(1, Math.ceil(fair * (1 - fond)));
  const bid = o.price ?? least;
  if (bid * o.qty > pay && bid >= least) return no(`That is ${bid * o.qty} coins, ${who}. You have ${pay}.`);
  if (bid >= least) return { answer: "accept", fixed: false, price: bid, why: `${o.good} is ${fair}c on the board` };
  return bid >= least * 0.7 ? { answer: "counter", fixed: false, price: least, why: `${bid}c is under the board's ${fair}c` } : no(`${bid} coins? No, ${who}. The board says ${fair}.`);
}

// How much the person is willing, for the model's prompt: the facts it may not change are already in `v`.
export function dealScore(p: Persona, b: Bond | undefined): number {
  const limit = dealLimit(p);
  const f = b?.fondness ?? 0;
  const t = b?.trust ?? 0;
  return Math.max(0, Math.min(1, 0.5 + (f - limit - 15) / 120 + (t <= GRUDGE_TRUST / 2 ? -0.25 : 0)));
}

export function dealPrompt(p: Persona, o: Offer, v: Verdict, from: string, score: number): LmRequest {
  const act = o.kind === "sell" ? `sell you ${o.qty} ${o.good}` : `buy ${o.qty} ${o.good} from you`;
  return {
    system: "You are a villager in a cozy game. Reply only in the requested format.",
    user: `${personaCard(p).slice(0, 150)}\n${from.slice(0, 24)} wants to ${act} at ${o.price ?? v.price} coins each. Fair price ${v.price}. ${v.why}.\nWillingness ${score.toFixed(2)}. Reply accept, counter, or refuse.`,
    grammar: 'root ::= "accept" | "counter" | "refuse"',
    maxTokens: 4,
    temperature: 0.5,
  };
}

export function parseDeal(text: string): DealAnswer | null {
  const t = text.trim().toLowerCase();
  return t === "accept" || t === "counter" || t === "refuse" ? t : null;
}

export function dealLine(answer: DealAnswer, o: Offer, price: number, who: string): string {
  const total = price * o.qty;
  if (answer === "refuse") return `No, ${who}. Not for that.`;
  if (answer === "counter") return o.kind === "sell" ? `I can pay ${price} each, ${total} in all. Deal?` : `${price} each, ${total} in all. Deal?`;
  if (o.kind === "sell") return `Deal. ${total} coins for ${o.qty} ${o.good}.`;
  return `Deal. ${o.qty} ${o.good} for ${total} coins.`;
}

export function giftLine(p: Persona, g: Good, m: Market, who: string): string {
  if (m.wanted[g]?.includes(p.name)) return `${g}! Just what I was after today. Thank you, ${who}!`;
  return (p.likes ?? []).includes(g) ? `I love ${g}. Thank you, ${who}!` : `For me? That is kind, ${who}.`;
}

// A question about prices or stock is answered from the books, never from a model's guess.
export function priceAnswer(line: string, m: Market, p: Purse): string | null {
  const l = line.toLowerCase();
  if (!/\b(how much|price|cost|worth)\b/.test(l) && !/\bwhat (?:do you have|are you selling|have you got)\b/.test(l)) return null;
  const g = GOOD_WORD.exec(l)?.[1]?.replace(/s$/, "");
  const good = g === "tomatoe" || g === "tomato" ? "tomato" : g === "herb" || g === "herbs" ? "herbs" : g;
  if (good && isGood(good)) return `${good[0]!.toUpperCase()}${good.slice(1)} is ${priceOf(m, good)} coins on the board today.`;
  const stock = GOOD_IDS.filter((x) => p.goods[x]).map((x) => `${p.goods[x]} ${x}`).join(", ");
  return stock ? `I have ${stock}. Prices are on the board.` : `Nothing right now. Prices are on the board.`;
}

// ---- the board

export interface BoardRow {
  label: string;
  note?: string;
}

const title = (g: string): string => `${g[0]!.toUpperCase()}${g.slice(1)}`;

export function boardRows(m: Market): BoardRow[] {
  const rows: BoardRow[] = [];
  for (let i = 0; i < GOOD_IDS.length; i += 2) {
    const [a, b] = [GOOD_IDS[i]!, GOOD_IDS[i + 1]!];
    rows.push({ label: `${title(a)} ${priceOf(m, a)}c`, note: `${title(b)} ${priceOf(m, b)}c` });
  }
  for (const g of GOOD_IDS) for (const name of m.wanted[g] ?? []) rows.push({ label: `${name} wants ${g}` });
  for (const t of m.trades.slice(-2)) rows.push({ label: `${t.who} sold ${Math.abs(t.qty)} ${t.good}`, note: `${t.price}c` });
  return rows;
}
