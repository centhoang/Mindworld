import { describe, expect, it } from "vitest";
import { lastLineSource, serviceLabel } from "./inspector";

describe("the inspector names who answered a mind's last line", () => {
  it("plain words first, the model after", () => {
    expect(serviceLabel("Llama 3.2 1B, tuned by us (in browser, WebGPU)")).toBe("thought on your computer (Llama 3.2 1B, tuned)");
    expect(serviceLabel("model")).toBe("from the cloud (Muse Spark Open)");
    expect(serviceLabel("cache")).toBe("from the cloud (Muse Spark Open)");
    expect(serviceLabel("Muse Spark")).toBe("from the cloud (Muse Spark Open)");
    expect(serviceLabel("Muse Spark Open (cloud)")).toBe("from the cloud (Muse Spark Open)");
    expect(serviceLabel("Muse Spark 1.3")).toBe("from the cloud (Muse Spark 1.3, Meta Model API)");
    expect(serviceLabel("rules")).toBe("the village rules (no model)");
    expect(serviceLabel("offline")).toBe("a scripted line (no model)");
  });
});

describe("the inspector's last line is the last thing said, not the last decision (bug 65)", () => {
  it("a cloud reply to the player stays shown after a rules decision; a pet that only decides shows that", () => {
    expect(lastLineSource({ source: "rules", lineSource: "model" })).toBe("model");
    expect(serviceLabel(lastLineSource({ source: "rules", lineSource: "model" }))).toBe("from the cloud (Muse Spark Open)");
    expect(lastLineSource({ source: "Llama 3.2 1B, tuned by us (in browser, WebGPU)" })).toMatch(/Llama/);
  });
});
