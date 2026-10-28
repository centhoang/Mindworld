import { describe, expect, it } from "vitest";
import { actualCostUsd, worstCaseCostUsd } from "../src/pricing";

describe("Modal pricing", () => {
  it.each([
    { provider: "modal", input: 1.25, cached: 0.15, output: 4.25, mixed: 4.95 },
    { provider: "glimmer", input: 0.30, cached: 0.03, output: 4.00, mixed: 4.165 },
  ] as const)("charges input, cached input and output for $provider", ({ provider, input, cached, output, mixed }) => {
    expect(actualCostUsd(provider, { inputTokens: 1e6, cachedInputTokens: 0, outputTokens: 0 })).toBe(input);
    expect(actualCostUsd(provider, { inputTokens: 1e6, cachedInputTokens: 1e6, outputTokens: 0 })).toBe(cached);
    expect(actualCostUsd(provider, { inputTokens: 0, cachedInputTokens: 0, outputTokens: 1e6 })).toBe(output);
    const real = actualCostUsd(provider, { inputTokens: 1e6, cachedInputTokens: 5e5, outputTokens: 1e6 });
    expect(real).toBeCloseTo(mixed, 10);
    expect(worstCaseCostUsd(provider, 1e6, 1e6)).toBeGreaterThanOrEqual(real);
  });
});
