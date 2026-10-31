import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EARS, HORNS, PATTERNS, TAILS, type PetLook } from "../game/genes";
import { composePetPixels, NATIVE_SIZES, PET_BUILDS, petLayerFiles, petRamp, petSize, petStates, placePetPixels } from "./pet-parts";

const look: PetLook = { hue: 0, accentHue: 0.4, ears: "pointy", tail: "fox", horns: "nubs", pattern: "belly", size: 1 };
afterEach(() => vi.unstubAllGlobals());

describe("pet layer selection", () => {
  it("names all six layers in assembly order", () => {
    expect(petLayerFiles(look, 64, "back", "brute")).toEqual([
      "tail-fox", "body-base", "ears-pointy", "horns-nubs", "pattern-belly", "face-eyes",
    ].map(part => `/art/gen/pets/pet-brute-${part}-32-back-idle.png`));
  });

  it("maps every gene value to an existing state in every build, size and view", () => {
    const genes = { ears: EARS, tail: TAILS, horns: HORNS, pattern: PATTERNS };
    for (const [part, values] of Object.entries(genes)) for (const value of values) {
      const variant = { ...look, [part]: value };
      expect(petStates(variant)[part as keyof typeof genes]).toBe(value);
      for (const build of PET_BUILDS) for (const size of NATIVE_SIZES) for (const facing of ["front", "back"] as const) {
        for (const file of petLayerFiles(variant, size, facing, build)) {
          expect(existsSync(fileURLToPath(new URL(`../../public${file}`, import.meta.url))), file).toBe(true);
        }
      }
    }
  });

  it("uses safe nearby states for future genes and unknown builds", () => {
    const future = { ...look, ears: "bear", tail: "long", horns: "crown", pattern: "diamonds" } as unknown as PetLook;
    expect(petStates(future)).toEqual({ ears: "round", tail: "none", horns: "none", pattern: "plain" });
    expect(petLayerFiles(future, 16, "front", "new-build")[0]).toBe("/art/gen/pets/pet-pal-tail-none-16-front-idle.png");
  });
});

describe("integer pet sizes and the existing foot baseline", () => {
  it.each([
    [16, 16, 1, 0, 0], [20, 16, 1, 2, 4], [24, 16, 1, 4, 8],
    [32, 32, 1, 0, 0], [40, 32, 1, 4, 8], [48, 48, 1, 0, 0],
    [64, 32, 2, 0, 0], [80, 48, 1, 16, 30],
  ])("%i uses native %i at %ix and offset (%i,%i)", (size, native, scale, x, y) => {
    expect(petSize(size)).toEqual({ native, scale, x, y });
  });

  it("replicates whole pixels and bottom-aligns a nondivisible size", () => {
    const pixels = new Uint8ClampedArray(16 * 16 * 4);
    pixels.set([10, 20, 30, 255], (13 * 16 + 8) * 4);
    const out = placePetPixels(pixels, 24);
    expect([...out.slice((21 * 24 + 12) * 4, (21 * 24 + 12) * 4 + 4)]).toEqual([10, 20, 30, 255]);
    const dot = new Uint8ClampedArray(32 * 32 * 4);
    dot.set([10, 20, 30, 255], (13 * 32 + 8) * 4);
    const big = placePetPixels(dot, 64);
    expect(Array.from(big).filter((_, i) => i % 4 === 3 && big[i] === 255)).toHaveLength(4);
  });
});

describe("shared RGBA composition", () => {
  it("merges before one 8-neighbour outline and preserves face/horn material", () => {
    const body = new Uint8ClampedArray(5 * 5 * 4);
    const ear = body.slice();
    body.set([0xC8, 0x7F, 0x5B, 255], (2 * 5 + 2) * 4);
    ear.set([0xE4, 0xD5, 0x72, 255], (1 * 5 + 2) * 4);
    const out = composePetPixels(look, 5, [body, ear]);
    const pixel = (x: number, y: number) => [...out.slice((y * 5 + x) * 4, (y * 5 + x) * 4 + 4)];
    expect(pixel(2, 2)).toEqual([0xC8, 0x7F, 0x5B, 255]);
    expect(pixel(2, 1)).toEqual([0xE4, 0xD5, 0x72, 255]);
    expect(pixel(1, 0)).toEqual([0x73, 0x3E, 0x39, 255]);
    expect(pixel(0, 0)).toEqual([0, 0, 0, 0]);
    expect(pixel(1, 3)[3]).toBe(255);
    expect(pixel(1, 4)[3]).toBe(0); // the outline never grows a second pass
    expect(body[(2 * 5 + 2) * 4]).toBe(0xC8);
  });

  it("recolours exact primary and accent roles only, without cascading replacements", () => {
    const pixels = new Uint8ClampedArray([
      0xBB, 0x6D, 0x53, 255, 0xC8, 0x7F, 0x5B, 255, 0xE8, 0xAD, 0x7D, 255,
      0x26, 0x5C, 0x42, 255, 0x3E, 0x89, 0x48, 255, 0x26, 0x2B, 0x44, 255,
      255, 255, 255, 255, 0xE4, 0xD5, 0x72, 255, 0, 0, 0, 0,
    ]);
    const out = composePetPixels({ ...look, hue: 0.7, accentHue: 0 }, 3, [pixels]);
    const [, shade, base, light] = petRamp(0.7);
    const hex = (i: number) => "#" + [...out.slice(i * 4, i * 4 + 3)].map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
    expect([hex(0), hex(1), hex(2)]).toEqual([shade, base, light]);
    expect([hex(3), hex(4), hex(5), hex(6), hex(7)]).toEqual(["#BB6D53", "#C87F5B", "#262B44", "#FFFFFF", "#E4D572"]);
  });
});

describe("nonblocking layer loading and retained sprites", () => {
  it("requests only one look once and upgrades the original cached canvas after loading", async () => {
    vi.resetModules();
    const requests: { src: string; naturalWidth: number; naturalHeight: number; onload: () => void; onerror: () => void }[] = [];
    vi.stubGlobal("Image", class {
      src = ""; naturalWidth = 16; naturalHeight = 16;
      onload = () => {}; onerror = () => {};
      constructor() { requests.push(this); }
    });
    const makeContext = () => ({
      fillRect: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(), putImageData: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray(16 * 16 * 4) }),
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    });
    vi.stubGlobal("document", { createElement: () => {
      const g = makeContext();
      return { width: 0, height: 0, getContext: () => g };
    } });
    const { drawMonster } = await import("./monster");
    const { composePet, preloadPet } = await import("./pet-parts");
    const original = drawMonster(look, 16, "front");
    expect(drawMonster({ ...look }, 16, "front")).toBe(original);
    expect(requests).toHaveLength(6);
    expect(composePet(look, 16, "front", "pal")).toBeNull();
    for (const image of requests) image.onload();
    expect(await preloadPet(look, 16, "front", "pal")).toBe(true);
    expect(original.getContext("2d")!.clearRect).toHaveBeenCalledWith(0, 0, 16, 16);
    expect(drawMonster(look, 16, "front")).toBe(original);
    expect(requests).toHaveLength(6);
  });

  it("keeps failed layers procedural without a retry storm", async () => {
    vi.resetModules();
    const requests: { onerror: () => void }[] = [];
    vi.stubGlobal("Image", class { onerror = () => {}; constructor() { requests.push(this); } });
    const { composePet, preloadPet } = await import("./pet-parts");
    const done = preloadPet(look, 16, "back", "turtle");
    expect(composePet(look, 16, "back", "turtle")).toBeNull();
    for (const image of requests) image.onerror();
    expect(await done).toBe(false);
    expect(await preloadPet(look, 16, "back", "turtle")).toBe(false);
    expect(requests).toHaveLength(6);
  });
});
