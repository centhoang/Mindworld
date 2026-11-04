// A villager watching a fight calls out once when it ends. The nearest awake villager outdoors is the watcher; its line
// for each ending is asked from the cloud when the fight starts (worker /api/cheer, Muse Spark Open on Baseten), so it
// is ready the moment the fight ends. Cloud off, late or failing: the villager's own lines below. The villager also
// remembers the fight, so it can come up in talk and in tomorrow's Gazette.
import type { Npc } from "../world/live";
import { CLOUD_LIVELY } from "./test-mode";

export type CheerEnd = "win" | "loss" | "friends" | "draw";
export interface Watcher {
  npc: Npc;
  name: string; // "Ama"
  feel: string; // "fond of Kai", from its memory ("" = no feeling yet)
}
export interface CheerLines {
  lines: Partial<Record<"win" | "loss" | "friends", string>>;
  by: string; // who wrote them: "Muse Spark Open" or "" (the villager's own lines)
}
export interface Watch extends Watcher {
  player: string;
  pet: string;
  foe: string; // "a wild Brute", "Mo's Ripple"
  lines: Promise<CheerLines>;
}

const WAIT_MS = 25_000;
const NONE: CheerLines = { lines: {}, by: "" };

const RULES: Record<Npc, Record<CheerEnd, string>> = {
  elder: {
    win: "Well fought. Your teaching shows, {player}.",
    loss: "Every loss is a lesson, {player}. Teach {pet} one more rule.",
    friends: "A friend won is better than a fight won.",
    draw: "Even. Patience will tip it next time.",
  },
  mo: {
    win: "Nice and steady, {pet}. Good catch.",
    loss: "Rough waters, {player}. Rest up and try again.",
    friends: "Huh. Friends. Did not see that coming.",
    draw: "Neither one gave an inch. Not bad.",
  },
  ama: {
    win: "Oh, well done, {pet}! Come by for a treat!",
    loss: "Oh, poor {pet}! Come have some soup, {player}.",
    friends: "Aww, look at them! New friends!",
    draw: "What a close one! You both need a snack.",
  },
  pip: {
    win: "WOOO! {pet} is so cool! Again!",
    loss: "Aww! So close! Rematch, rematch!",
    friends: "They are friends now? Best fight ever!",
    draw: "A tie?! No way! Again!",
  },
};

export const rulesCheer = (npc: Npc, end: CheerEnd, player: string, pet: string): string =>
  RULES[npc][end].replace("{player}", player).replace("{pet}", pet);

export async function fetchCheer(ask: { npc: Npc; player: string; pet: string; foe: string; duel: boolean; feel: string }, fetchFn: typeof fetch = (i, o) => fetch(i, o)): Promise<CheerLines> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), WAIT_MS);
  try {
    const res = await fetchFn("/api/cheer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(ask), signal: ctl.signal });
    if (!res.ok) return NONE;
    const b = (await res.json()) as { lines?: Record<string, unknown>; model?: unknown };
    const lines: CheerLines["lines"] = {};
    for (const k of ["win", "loss", "friends"] as const) {
      const v = b.lines?.[k];
      if (typeof v === "string" && v.trim().length >= 3) lines[k] = v.replace(/[^\p{L}\p{N} ,.!?'-]+/gu, "").trim().slice(0, 90);
    }
    return lines.win && lines.loss ? { lines, by: typeof b.model === "string" && /spark-1/.test(b.model) ? "Muse Spark 1.3" : "Muse Spark Open" } : NONE;
  } catch {
    return NONE;
  } finally {
    clearTimeout(timer);
  }
}

// At the fight's start: who watches, and their lines on the way (none asked when the cloud is off).
export function startWatch(w: Watcher | null, fight: { player: string; pet: string; foe: string; duel: boolean }, cloud = CLOUD_LIVELY, fetchFn?: typeof fetch): Watch | null {
  if (!w) return null;
  const lines = cloud ? fetchCheer({ npc: w.npc, feel: w.feel, ...fight }, fetchFn) : Promise.resolve(NONE);
  return { ...w, player: fight.player, pet: fight.pet, foe: fight.foe, lines };
}

// At the fight's end: the line for how it ended, waiting a moment at most for a cloud answer still on its way.
export async function watchLine(w: Watch, end: CheerEnd, waitMs = 1500): Promise<{ text: string; by: string }> {
  const got = await Promise.race([w.lines, new Promise<CheerLines>((r) => setTimeout(() => r(NONE), waitMs))]);
  const line = end === "draw" ? undefined : got.lines[end];
  return line ? { text: line, by: got.by } : { text: rulesCheer(w.npc, end, w.player, w.pet), by: "" };
}

// What the watcher remembers (mind/gazette.ts reads it back as a headline).
export function watchMemory(w: Watch, end: CheerEnd): string {
  const verb = end === "win" ? "beat" : end === "loss" ? "lose to" : end === "friends" ? "make friends with" : "draw with";
  return `watched ${w.player}'s pet ${w.pet} ${verb} ${w.foe}`;
}
