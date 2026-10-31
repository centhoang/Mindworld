// How a person types: replies take time, and each villager has its own casual habits and the odd slip. Applied to free
// lines only; answers that come from the sim (prices, reasons) stay exact. Pure and stable: the same line reads the
// same on every machine.

import type { Persona } from "./persona";

const TYPE_BASE_MS = 500;
const TYPE_CHAR_MS = 32;
const TYPE_MAX_MS = 3500;
const SLIP_EVERY = 6; // about one line in this many has a typo

export const typingMs = (text: string): number => Math.min(TYPE_MAX_MS, TYPE_BASE_MS + text.length * TYPE_CHAR_MS);

const has = (p: Persona, ...ts: string[]): boolean => p.traits.some((t) => ts.includes(t.toLowerCase()));
const hash = (s: string): number => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// Two neighbouring letters swap in a long lowercase word; names and short words stay readable.
function slip(text: string, h: number): string {
  const words = [...text.matchAll(/\b[a-z]{6,}\b/g)];
  const w = words[h % Math.max(1, words.length)];
  if (!w) return text;
  const i = w.index + 2;
  return `${text.slice(0, i)}${text[i + 1]}${text[i]}${text.slice(i + 2)}`;
}

export function humanize(text: string, p: Persona): string {
  const h = hash(text);
  let t = text;
  if (has(p, "loud", "playful")) t = `${t[0]!.toLowerCase()}${t.slice(1)}`.replace(/\.$/, "");
  else if (has(p, "chatty") && h % 3 === 0) t = t.replace(/\.$/, "...");
  if (!has(p, "tidy", "wise") && h % SLIP_EVERY === 0) t = slip(t, h);
  return t;
}
