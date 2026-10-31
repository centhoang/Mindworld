import { describe, expect, it } from "vitest";
import { gpuId, gpuVerdict, remembered, type GpuInfo } from "./setup";

const gpu = (vendor: string, architecture = "", description = "", fallback = false): GpuInfo => ({ vendor, architecture, description, fallback });

describe("gpuVerdict", () => {
  it("lets real GPUs through, GTX 1050 included", () => {
    expect(gpuVerdict(gpu("nvidia", "kepler", "NVIDIA GeForce GTX 1050"))).toBe("capable");
    expect(gpuVerdict(gpu("amd", "gcn-5"))).toBe("capable");
    expect(gpuVerdict(gpu("apple", "metal-3"))).toBe("capable");
    expect(gpuVerdict(gpu("intel", "gen-12lp"))).toBe("capable");
  });

  it("sends weak Intel chips to the switching guide", () => {
    expect(gpuVerdict(gpu("intel", "gen-9"))).toBe("switch");
    expect(gpuVerdict(gpu("intel", ""))).toBe("switch");
  });

  it("goes straight in without a usable GPU", () => {
    expect(gpuVerdict(null)).toBe("none");
    expect(gpuVerdict(gpu("google", "swiftshader", "SwiftShader"))).toBe("none");
    expect(gpuVerdict(gpu("nvidia", "", "", true))).toBe("none");
    expect(gpuVerdict(gpu("apple", "metal-3"), true)).toBe("none");
  });
});

describe("remembered", () => {
  const id = gpuId(gpu("nvidia", "x", "y"));
  it("reads the stored result for this GPU only", () => {
    expect(remembered(JSON.stringify({ gpu: id, ok: true }), id)).toBe("load");
    expect(remembered(JSON.stringify({ gpu: id, ok: false }), id)).toBe("skip");
    expect(remembered(JSON.stringify({ gpu: "other", ok: true }), id)).toBeNull();
  });

  it("treats missing or broken data as no result", () => {
    expect(remembered(null, id)).toBeNull();
    expect(remembered("{oops", id)).toBeNull();
  });
});
