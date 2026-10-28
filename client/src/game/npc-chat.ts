import { pickLine } from "./chatter";

// Talk to the elder or a wild pet: the Worker asks a Meta model (Muse Spark) for one short in-character
// line, capped and cached on the server. Never throws: offline or a bad reply gives a canned line.

export type ChatWho = "elder" | "brute" | "skitter" | "turtle" | "pal" | "bully";
export type ChatSource = "model" | "cache" | "scripted" | "offline";

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export const CHAT_MAX_LINE = 140;

export const chatWhoFor = (kind: string, archetype?: string): ChatWho | null =>
  kind === "npc" ? "elder" : kind === "wild" && archetype && ["brute", "skitter", "turtle", "pal", "bully"].includes(archetype) ? (archetype as ChatWho) : null;

export async function askNpc(
  who: ChatWho,
  line: string,
  base = "",
  fetchFn: FetchFn = (i, o) => fetch(i, o),
  timeoutMs = 20_000,
): Promise<{ text: string; source: ChatSource }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchFn(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ who, line: line.trim().slice(0, CHAT_MAX_LINE) }),
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
