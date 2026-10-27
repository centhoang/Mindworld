import { ghostPayload, localSeedGhost, parseGhostRecord, type Genes, type Ghost } from "../sim/ghost";
import type { Memo } from "../sim/memo";
import type { Slot } from "./home";

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

const TIMEOUT_MS = 4000;

async function timed(fetchFn: FetchFn, url: string, init: RequestInit = {}): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetchFn(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Never throws: offline, a server error or a bad record all fall back to a local seed ghost.
export async function fetchRandomGhost(
  base = "",
  fetchFn: FetchFn = (i, o) => fetch(i, o),
  random: () => number = Math.random,
): Promise<{ ghost: Ghost; online: boolean }> {
  try {
    const res = await timed(fetchFn, `${base}/api/ghosts/random`);
    if (res.ok) {
      const ghost = parseGhostRecord(await res.json());
      if (ghost) return { ghost, online: true };
    }
  } catch {
    /* offline or timed out */
  }
  return { ghost: localSeedGhost(random), online: false };
}

export type ShareResult = { ok: true; id: string } | { ok: false; reason: "rate_limited" | "rejected" | "offline" };

export async function shareGhost(
  name: string,
  genes: Genes,
  memo: Memo,
  decor: readonly Slot[] = [],
  base = "",
  fetchFn: FetchFn = (i, o) => fetch(i, o),
): Promise<ShareResult> {
  try {
    const res = await timed(fetchFn, `${base}/api/ghosts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ghostPayload(name, genes, memo, decor)),
    });
    if (res.status === 429) return { ok: false, reason: "rate_limited" };
    if (!res.ok) return { ok: false, reason: "rejected" };
    const { id } = (await res.json()) as { id?: unknown };
    return typeof id === "string" ? { ok: true, id } : { ok: false, reason: "rejected" };
  } catch {
    return { ok: false, reason: "offline" };
  }
}
