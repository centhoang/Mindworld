// Props on in-between grounds (playground, picnic hill, fishing pond), drawn at an activity spot's foot.
// Uses the ImageGen sheet `props-grounds` when it is loaded, else small code-drawn stand-ins in the palette.

import { hasArt, img, PAL } from "./art";
import { drawBall } from "./life-draw";
import { GROUND_PROPS } from "./grounds-props";
import type { DecorKind } from "./grounds-decor";
import { AWAY } from "./tiles";
import { generatedSprites } from "./generated-sprites";
import { stand, stampSize } from "./sunny";

type Ctx = CanvasRenderingContext2D;

const r = (g: Ctx, x: number, y: number, w: number, h: number, c: string) => {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), w, h);
};

// Spot name -> sheet item (the spots on a ground are named after what stands there).
const SHEET: Record<string, keyof typeof GROUND_PROPS> = { goal: "goal", ball: "ball", slide: "slide", blanket: "blanket", basket: "basket", bench: "bench", rod: "rod", sign: "sign" };

export function drawSpotProp(g: Ctx, name: string, x: number, y: number, t: number): void {
  if (name === "goal" || name === "ball") {
    generatedSprites.draw(g, name === "goal" ? "soccer-goal" : "soccer-ball", x, y - (name === "ball" ? Math.round(Math.abs(Math.sin(t * 3)) * 3) : 0), () => drawOldSpotProp(g, name, x, y, t));
    return;
  }
  if (name === "bench") return stand(g, "bench", x, y);
  if (name === "sign") return stand(g, "sign", x, y);
  drawOldSpotProp(g, name, x, y, t);
}

function drawOldSpotProp(g: Ctx, name: string, x: number, y: number, t: number): void {
  const item = SHEET[name];
  if (item && hasArt("props-grounds")) {
    const s = GROUND_PROPS[item];
    const hop = name === "ball" ? Math.round(Math.abs(Math.sin(t * 3)) * 3) : 0;
    g.drawImage(img("props-grounds"), s.x, s.y, s.w, s.h, Math.round(x - s.w / 2), Math.round(y - s.h) - hop, s.w, s.h);
    return;
  }
  switch (name) {
    case "goal": // white posts, crossbar and a net
      r(g, x - 20, y - 22, 2, 22, PAL.ink);
      r(g, x + 18, y - 22, 2, 22, PAL.ink);
      r(g, x - 20, y - 24, 40, 2, PAL.ink);
      r(g, x - 19, y - 23, 38, 1, PAL.panel);
      r(g, x - 19, y - 22, 1, 21, PAL.panel);
      r(g, x + 18, y - 22, 1, 21, PAL.panel);
      for (let k = -16; k < 18; k += 4) r(g, x + k, y - 22, 1, 20, PAL.stoneL);
      for (let k = -20; k < 0; k += 4) r(g, x - 18, y + k, 36, 1, PAL.stoneL);
      return;
    case "ball":
      drawBall(g, x, y - Math.abs(Math.sin(t * 3)) * 3);
      return;
    case "slide":
      r(g, x - 6, y - 18, 2, 18, PAL.woodD);
      r(g, x - 6, y - 18, 6, 2, PAL.wood);
      for (let k = 0; k < 7; k++) r(g, x - 4 + k * 2, y - 16 + k * 2, 3, 2, PAL.coral);
      return;
    case "blanket": // checked cloth lying flat
      for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) r(g, x - 18 + i * 6, y - 12 + j * 4, 6, 4, (i + j) % 2 ? PAL.coral : PAL.cream);
      return;
    case "basket":
      r(g, x - 5, y - 7, 10, 7, PAL.woodD);
      r(g, x - 4, y - 6, 8, 5, PAL.woodM);
      r(g, x - 3, y - 10, 6, 1, PAL.woodD);
      r(g, x - 4, y - 9, 1, 3, PAL.woodD);
      r(g, x + 3, y - 9, 1, 3, PAL.woodD);
      return;
    case "bench":
      r(g, x - 12, y - 10, 24, 3, PAL.wood);
      r(g, x - 12, y - 14, 24, 2, PAL.woodM);
      r(g, x - 11, y - 7, 2, 7, PAL.woodD);
      r(g, x + 9, y - 7, 2, 7, PAL.woodD);
      return;
    case "rod":
      for (let k = 0; k < 12; k++) r(g, x - 2 + k * 0.6, y - 2 - k * 1.4, 1, 2, PAL.woodD);
      r(g, x + 5, y - 18, 1, 14 + Math.round(Math.sin(t * 2)), PAL.stoneL);
      return;
    default: // spots with nothing to draw (the pond is water tiles, the dock bridge tiles)
  }
}

const DECOR_ART: Record<Exclude<DecorKind, "lights" | "fence">, string> = { bush: "bush", "bush-big": "bush-berry", rock: "rock-small", "rock-big": "rock-big", stump: "stump", jar: "jar" };

// Outdoor decor (grounds-decor.ts) at its foot, recoloured with the ground's theme like the trees. Party
// lights hang on two posts and glow after dark. `tiles` = how many tiles wide, `look` = the tile's look
// bits (theme | AWAY).
export function drawDecor(g: Ctx, kind: DecorKind, x: number, y: number, tiles: number, look: number, night: boolean): void {
  if (look & AWAY) g.globalAlpha = 0.6;
  if (kind === "lights") {
    r(g, x - 24, y - 26, 2, 26, PAL.woodD);
    r(g, x + 22, y - 26, 2, 26, PAL.woodD);
    if (hasArt("props-grounds")) {
      const s = GROUND_PROPS.lights;
      g.drawImage(img("props-grounds"), s.x, s.y, s.w, s.h, Math.round(x - s.w / 2), Math.round(y - 30), s.w, s.h);
    } else for (let k = -20; k <= 20; k += 5) r(g, x + k, y - 24 + Math.round(Math.cos((k / 20) * 1.4) * 4), 2, 2, k % 2 ? PAL.flowerY : PAL.coral);
    if (night) {
      g.globalAlpha *= 0.25;
      for (let k = -18; k <= 18; k += 9) r(g, x + k - 2, y - 24, 5, 5, PAL.flowerY);
    }
  } else if (kind === "fence") {
    const w = stampSize("fence-a")[0];
    for (let k = 0; k < Math.max(1, Math.round((tiles * 16) / w)); k++) stand(g, "fence-a", x + k * w, y);
  } else stand(g, DECOR_ART[kind], x, y);
  g.globalAlpha = 1;
}
