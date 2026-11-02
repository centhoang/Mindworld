import { SCENE_MAX } from "../mind/scene";
import { pickLine } from "./chatter";

// Talk to the elder or a wild pet: the Worker asks a Meta model (Muse Spark) for one short in-character
// line, capped and cached on the server. Never throws: offline or a bad reply gives a canned line.

export type ChatWho = "elder" | "brute" | "skitter" | "turtle" | "pal" | "bully" | "mo" | "ama" | "pip";
export type ChatSource = "model" | "cache" | "scripted" | "offline";

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export const CHAT_MAX_LINE = 140;
export const MIND_MAX = 1400;
const CLOUD_WAIT_MS = 12_000; // past this the local model has the better chance

export const chatWhoFor = (kind: string, archetype?: string): ChatWho | null =>
  kind === "npc" ? "elder" : kind === "wild" && archetype && ["brute", "skitter", "turtle", "pal", "bully"].includes(archetype) ? (archetype as ChatWho) : null;

export async function askNpc(
  who: ChatWho,
  line: string,
  base = "",
  fetchFn: FetchFn = (i, o) => fetch(i, o),
  timeoutMs = 20_000,
  scene = "", // what the player and the NPC both see (mind/scene.ts); the Worker adds it to the prompt
  mind = "", // a villager's card, memories and the talk so far: the Worker then answers this very talk
): Promise<{ text: string; source: ChatSource }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchFn(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ who, line: line.trim().slice(0, CHAT_MAX_LINE), ...(scene ? { scene: scene.slice(0, SCENE_MAX) } : {}), ...(mind ? { mind: mind.slice(0, MIND_MAX) } : {}) }),
      signal: ctl.signal,
    });
    if (res.ok) {
      const b = (await res.json()) as { text?: unknown; source?: unknown };
      if (typeof b.text === "string" && b.text.trim()) {
        const source: ChatSource = b.source === "model" || b.source === "cache" ? b.source : "scripted";
        return { text: b.text.trim().slice(0, 220), source };
      }
    }
  } catch {
    /* offline, timed out or not JSON */
  } finally {
    clearTimeout(timer);
  }
  return { text: pickLine(who, Math.random), source: "offline" };
}

// Free talk, tier 2: a real model line or null, so the caller drops to the local model on a cap, a failure or a canned line.
export async function cloudLine(who: ChatWho, line: string, scene = "", mind = "", fetchFn?: FetchFn): Promise<{ text: string; source: string } | null> {
  const r = await askNpc(who, line, "", fetchFn, CLOUD_WAIT_MS, scene, mind);
  return r.source === "model" || r.source === "cache" ? r : null;
}
