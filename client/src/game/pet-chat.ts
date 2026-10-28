import type { Memo } from "../sim/memo";

// Two pets meet (yours and another player's or a ghost's): the Worker asks Muse Spark for one line each,
// capped and cached by trait pair. Only a cleaned name and a trait word are sent. Never throws.

export const PET_TRAITS = ["bold", "careful", "cautious", "cheerful", "friendly", "curious"] as const;
export type PetTrait = (typeof PET_TRAITS)[number];

const TRAIT_OF: Record<string, PetTrait> = { attack: "bold", guard: "careful", flee: "cautious", emote: "cheerful", befriend: "friendly" };

// The pet's character is its most-taught move; an untaught pet is curious.
export function traitOf(memo: Memo | null | undefined): PetTrait {
  const n: Record<string, number> = {};
  for (const r of memo?.rules ?? []) n[r.do] = (n[r.do] ?? 0) + 1;
  const top = Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0];
  return (top && TRAIT_OF[top]) || "curious";
}

const FALLBACK: [string, string][] = [
  ["Oh, hi there!", "Hello! Nice to meet you!"],
  ["Want to explore together?", "Yes! Let's go!"],
];

export async function askPets(
  a: { name: string; trait: PetTrait },
  b: { name: string; trait: PetTrait },
  base = "",
  fetchFn: typeof fetch = (i, o) => fetch(i, o),
): Promise<{ lines: [string, string]; source: string }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15_000);
  try {
    const res = await fetchFn(`${base}/api/petchat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ a, b }),
      signal: ctl.signal,
    });
    if (res.ok) {
      const j = (await res.json()) as { lines?: unknown; source?: unknown };
      if (Array.isArray(j.lines) && j.lines.length === 2 && j.lines.every((l) => typeof l === "string" && l.trim())) {
        return { lines: [String(j.lines[0]).slice(0, 120), String(j.lines[1]).slice(0, 120)], source: String(j.source ?? "scripted") };
      }
    }
  } catch {
    /* offline */
  } finally {
    clearTimeout(timer);
  }
  return { lines: FALLBACK[Math.floor(Math.random() * FALLBACK.length)]!, source: "offline" };
}
