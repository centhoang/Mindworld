import { estimateInputTokens } from "./pricing";
import type { Completion } from "./providers";

export const LLM_KINDS = ["memo", "teach", "chat", "dialogue", "move"] as const;
export type LlmKind = (typeof LLM_KINDS)[number];

// Deterministic, free stand-in for the paid models (LLM_MOCK=1 and tests). It never learns anything:
// real coaching is only exercised against the real models; the client has its own scripted Cortex double.
export function mockCompletion(kind: LlmKind, system: string | undefined, prompt: string): Completion {
  const text =
    kind === "memo" || kind === "teach"
      ? JSON.stringify({ summary: "[mock] no new lessons", rules: [] })
      : kind === "move"
        ? "attack: Hyaa!"
        : "[mock] ...";
  return {
    text,
    truncated: false,
    model: "mock",
    usage: {
      inputTokens: estimateInputTokens((system ?? "") + prompt),
      cachedInputTokens: 0,
      outputTokens: Math.ceil(text.length / 3),
    },
  };
}
