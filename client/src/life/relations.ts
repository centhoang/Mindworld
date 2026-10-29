// Relationships: one affinity number per pair of minds, -100 (rivals) .. 100 (best friends). Shared
// activities and friendly talk raise it; it biases who joins whose gathering and how minds talk.

export const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function bump(rel: Map<string, number>, a: string, b: string, by: number): number {
  const k = pairKey(a, b);
  const v = Math.max(-100, Math.min(100, (rel.get(k) ?? 0) + by));
  rel.set(k, v);
  return v;
}

export function friends(rel: Map<string, number>, id: string, min = 20): { id: string; affinity: number }[] {
  const out: { id: string; affinity: number }[] = [];
  for (const [k, v] of rel) {
    const [a, b] = k.split("|") as [string, string];
    if (v >= min && (a === id || b === id)) out.push({ id: a === id ? b : a, affinity: v });
  }
  return out.sort((x, y) => y.affinity - x.affinity);
}
