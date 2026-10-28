export type Provider = "baseten" | "meta" | "modal" | "glimmer";
export const PROVIDERS: readonly Provider[] = ["baseten", "meta", "modal", "glimmer"];

// USD per 1M tokens. Meta lists $1.25 in / $0.15 cached in / $4.25 out for Muse Spark; Baseten's Muse
// Spark Open price is not confirmed, so it is assumed equal (Fireworks charges the same). Update if it differs.
const PRICE_PER_MTOK: Record<Provider, { input: number; cachedInput: number; output: number }> = {
  baseten: { input: 1.25, cachedInput: 0.15, output: 4.25 },
  meta: { input: 1.25, cachedInput: 0.15, output: 4.25 },
  modal: { input: 1.25, cachedInput: 0.15, output: 4.25 },
  // Notional GPU-time equivalent for the dedicated Glimmer endpoint, not token billing.
  glimmer: { input: 0.30, cachedInput: 0.03, output: 4.00 },
};

export interface Usage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number; // includes reasoning tokens
}

// A byte-level BPE tokenizer never emits more tokens than UTF-8 bytes, so bytes (+ headroom for the chat
// template) is a true upper bound, also for CJK/emoji. About 4x too high for English, which is the safe side.
const encoder = new TextEncoder();
export function estimateInputTokens(text: string): number {
  return encoder.encode(text).length + 64;
}

// Upper bound on one call: all input uncached, all of max output (reasoning included) generated.
export function worstCaseCostUsd(provider: Provider, inputTokens: number, maxOutputTokens: number): number {
  const p = PRICE_PER_MTOK[provider];
  return (inputTokens * p.input + maxOutputTokens * p.output) / 1e6;
}

export function actualCostUsd(provider: Provider, usage: Usage): number {
  const p = PRICE_PER_MTOK[provider];
  const cached = Math.min(usage.cachedInputTokens, usage.inputTokens);
  const uncached = usage.inputTokens - cached;
  return (uncached * p.input + cached * p.cachedInput + usage.outputTokens * p.output) / 1e6;
}
