import { describe, expect, it, vi } from "vitest";
import { limitsFromEnv } from "../src/spend-do";

// Unit-test env parsing without a Workers runtime or any upstream calls.
vi.mock("cloudflare:workers", () => ({ DurableObject: class {} }));

describe("limitsFromEnv", () => {
  it("defaults the four event caps", () => {
    expect(limitsFromEnv({}).totalUsd).toEqual({ baseten: 50, meta: 100, modal: 20, glimmer: 30 });
  });

  it("honors explicit Modal caps, including zero", () => {
    expect(limitsFromEnv({ MAX_TOTAL_USD_MODAL: "0", MAX_TOTAL_USD_GLIMMER: "12.5" }).totalUsd)
      .toMatchObject({ modal: 0, glimmer: 12.5 });
  });

  it.each(["", "invalid", "-1", "Infinity"])("uses defaults for invalid caps (%s)", (value) => {
    expect(limitsFromEnv({ MAX_TOTAL_USD_MODAL: value, MAX_TOTAL_USD_GLIMMER: value }).totalUsd)
      .toMatchObject({ modal: 20, glimmer: 30 });
  });
});
