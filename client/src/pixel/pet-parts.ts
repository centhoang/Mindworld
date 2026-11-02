import type { PetLook } from "../game/genes";

export type PetFacing = "front" | "back";
export const PET_BUILDS = ["pal", "brute", "skitter", "turtle", "bully"] as const;
export type PetBuild = typeof PET_BUILDS[number];
export const NATIVE_SIZES = [16, 32, 48] as const;

// O/S/B/L, from batch2-manifest.json. Shared with the procedural fallback.
export const RAMPS = [
  ["#733E39", "#BB6D53", "#C87F5B", "#E8AD7D"],
  ["#B74851", "#B74851", "#E17276", "#FF979B"],
  ["#BE4A2F", "#BE4A2F", "#FEAE34", "#FEE761"],
  ["#193C3E", "#265C42", "#3E8948", "#63C74D"],
  ["#193C3E", "#265C42", "#3E8948", "#53A641"],
  ["#124E89", "#1E6DD5", "#0099DB", "#2CE8F5"],
  ["#262B44", "#5A6988", "#8B9BB4", "#C0CBDC"],
  ["#733E39", "#B86F50", "#C58A63", "#E4A672"],
] as const;

export function petRamp(hue: number) {
  const h = Number.isFinite(hue) ? ((hue % 1) + 1) % 1 : 0;
  return RAMPS[Math.floor(h * RAMPS.length)]!;
}

const STATES = {
  tail: ["none", "nub", "puff", "curl", "fox"],
  ears: ["pointy", "round", "floppy", "bunny", "tuft"],
  horns: ["none", "nubs", "unicorn", "antlers"],
  pattern: ["plain", "belly", "stripes"],
} as const;

export function petStates(look: PetLook) {
  const state = (part: keyof typeof STATES, value: string) => {
    const available: readonly string[] = STATES[part];
    // Unknown future genes use the nearest neutral shape, never a nonexistent URL.
    return available.includes(value) ? value : part === "ears" ? "round" : available[0]!;
  };
  return {
    tail: state("tail", look.tail), ears: state("ears", look.ears),
    horns: state("horns", look.horns), pattern: state("pattern", look.pattern),
  };
}

export function petSize(size: number) {
  const native = [...NATIVE_SIZES].reverse().find(n => size % n === 0 && size / n <= 2) // 2x at most: a 5x 16 px pet is a blur of blocks
    ?? [...NATIVE_SIZES].reverse().find(n => n <= size) ?? 16;
  const scale = size % native === 0 && size / native <= 2 ? size / native : 1;
  const root = native === 48 ? 45 : native - 2;
  // Centre horizontally; retain the old monster's ground line vertically.
  return { native, scale, x: Math.floor((size - native * scale) / 2),
    y: Math.round(size - Math.max(2, size * 0.06)) - root * scale };
}

export function petLayerFiles(look: PetLook, size: number, facing: PetFacing, buildName: string) {
  const build = PET_BUILDS.includes(buildName as PetBuild) ? buildName : "pal";
  const states = petStates(look);
  const slots = [["tail", states.tail], ["body", "base"], ["ears", states.ears],
    ["horns", states.horns], ["pattern", states.pattern], ["face", "eyes"]];
  return slots.map(([part, state]) => `/art/gen/pets/pet-${build}-${part}-${state}-${petSize(size).native}-${facing}-idle.png`);
}

const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const colorKey = (r: number, g: number, b: number) => (r << 16) | (g << 8) | b;

// Pure RGBA composition is also used by the Node acceptance sheet. Source layers
// have binary alpha and no outline. Shadows are separate and never enter this mask.
export function composePetPixels(look: PetLook, native: number, layers: readonly Uint8ClampedArray[]) {
  const merged = new Uint8ClampedArray(native * native * 4);
  for (const layer of layers) for (let i = 0; i < merged.length; i += 4) {
    if (layer[i + 3] === 255) merged.set(layer.subarray(i, i + 4), i);
  }
  const [outline, shade, base, light] = petRamp(look.hue);
  const [, accentShade, accent] = petRamp(look.accentHue);
  const roles = new Map([
    [0xBB6D53, rgb(shade)], [0xC87F5B, rgb(base)], [0xE8AD7D, rgb(light)],
    [0x265C42, rgb(accentShade)], [0x3E8948, rgb(accent)],
  ]);
  const out = merged.slice();
  const edge = [...rgb(outline), 255];
  for (let y = 0; y < native; y++) for (let x = 0; x < native; x++) {
    const i = (y * native + x) * 4;
    if (merged[i + 3]) {
      const color = roles.get(colorKey(merged[i]!, merged[i + 1]!, merged[i + 2]!));
      if (color) out.set(color, i);
    } else {
      let touches = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < native && ny >= 0 && ny < native && merged[(ny * native + nx) * 4 + 3]) touches = true;
      }
      if (touches) out.set(edge, i);
    }
  }
  return out;
}

// Apply only integer replication. The size gene never fractionally resamples art.
export function placePetPixels(pixels: Uint8ClampedArray, size: number) {
  const { native, scale, x, y } = petSize(size);
  const out = new Uint8ClampedArray(size * size * 4);
  for (let sy = 0; sy < native; sy++) for (let sx = 0; sx < native; sx++) {
    const i = (sy * native + sx) * 4;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const px = x + sx * scale + dx, py = y + sy * scale + dy;
      if (px >= 0 && px < size && py >= 0 && py < size) out.set(pixels.subarray(i, i + 4), (py * size + px) * 4);
    }
  }
  return out;
}

interface Layer { pixels: Uint8ClampedArray | null; done: Promise<boolean> }
const images = new Map<string, Layer>();
const queue: (() => void)[] = [];
let active = 0;
function pump() {
  while (active < 6 && queue.length) { active++; queue.shift()!(); }
}
function layer(src: string): Layer {
  const cached = images.get(src);
  if (cached) return cached;
  const entry: Layer = { pixels: null, done: Promise.resolve(false) };
  images.set(src, entry);
  entry.done = new Promise(resolve => {
    if (typeof Image === "undefined") { resolve(false); return; }
    queue.push(() => {
      const image = new Image();
      const finish = (ok: boolean) => { active--; resolve(ok); pump(); };
      image.onerror = () => finish(false);
      image.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = image.naturalWidth; c.height = image.naturalHeight;
          const g = c.getContext("2d")!;
          g.drawImage(image, 0, 0);
          entry.pixels = g.getImageData(0, 0, c.width, c.height).data;
          finish(true);
        } catch { finish(false); }
      };
      image.src = src;
    });
    pump();
  });
  return entry;
}

// First drawMonster calls occur during world construction, alongside loadArt.
// Only the requested look/build/tier/view is preloaded, once; later looks are lazy.
export function preloadPet(look: PetLook, size: number, facing: PetFacing, buildName: string): Promise<boolean> {
  return Promise.all(petLayerFiles(look, size, facing, buildName).map(src => layer(src).done)).then(ready => ready.every(Boolean));
}

export function composePet(look: PetLook, size: number, facing: PetFacing, buildName: string): HTMLCanvasElement | null {
  const layers = petLayerFiles(look, size, facing, buildName).map(src => layer(src).pixels);
  if (layers.some(pixels => !pixels)) return null;
  const native = petSize(size).native;
  if (layers.some(pixels => pixels!.length !== native * native * 4)) return null;
  const c = document.createElement("canvas"); c.width = size; c.height = size;
  const g = c.getContext("2d");
  if (!g) return null;
  const data = g.createImageData(size, size);
  data.data.set(placePetPixels(composePetPixels(look, native, layers as Uint8ClampedArray[]), size));
  g.putImageData(data, 0, 0);
  return c;
}
