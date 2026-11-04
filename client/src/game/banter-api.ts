// Villagers talking to each other from the cloud (P5d): a whole short talk between two villagers, or an evening
// campfire story, written in one call by Muse Spark Open (worker /api/banter) from each villager's notes. The minds
// (mind/npcs.ts) ask only while a player is close enough to hear; cloud off, late or failing = null, and the
// villagers' local model or scripted lines play as before.
import type { Npc } from "../world/live";
import { NPCS } from "../world/live";

export interface BanterAsk {
  kind: "chat" | "story";
  who: Npc[]; // the villagers in the talk; the first one opens it or tells the story
  speak: Npc[]; // the ones this machine hosts: only they get lines
  notes: Partial<Record<Npc, string>>;
  listeners: string[]; // players close by (sitting at the fire, for a story)
  place: string;
  time: string;
  said: string[];
  lines: number;
}
export interface BanterLine {
  who: Npc;
  text: string;
}
export interface Banter {
  lines: BanterLine[];
  by: string; // "Muse Spark Open"
}
export type BanterFn = (ask: BanterAsk) => Promise<Banter | null>;

const WAIT_MS = 20_000;

export async function fetchBanter(ask: BanterAsk, fetchFn: typeof fetch = (i, o) => fetch(i, o), waitMs = WAIT_MS): Promise<Banter | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), waitMs);
  try {
    const res = await fetchFn("/api/banter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(ask), signal: ctl.signal });
    if (!res.ok) return null;
    const b = (await res.json()) as { lines?: unknown; model?: unknown };
    const lines: BanterLine[] = [];
    for (const l of Array.isArray(b.lines) ? b.lines : []) {
      const r = l as { who?: unknown; text?: unknown };
      if (typeof r?.who !== "string" || !(NPCS as readonly string[]).includes(r.who) || !ask.speak.includes(r.who as Npc)) continue;
      const text = typeof r.text === "string" ? r.text.replace(/[^\p{L}\p{N} ,.!?'-]+/gu, "").trim().slice(0, 80) : "";
      if (text.length >= 3) lines.push({ who: r.who as Npc, text });
    }
    return lines.length ? { lines, by: typeof b.model === "string" && /spark-1/.test(b.model) ? "Muse Spark 1.3" : "Muse Spark Open" } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
