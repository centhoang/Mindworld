// Entry for the pixel (v2) build: a low-res game canvas, the scene stack and the CRT presenter.
// Stage S1: overworld walking + CRT toggle. Battle, interior and the v1 game wiring join in later stages.

import { makePresenter } from "./crt";
import { Overworld } from "./overworld";
import { drawDialogue } from "./text";

export const LOW_H = 216;

// Low-res width follows the window's aspect so phones and wide screens both fill, height stays 216.
export function lowSize(cssW: number, cssH: number): { w: number; h: number } {
  const w = Math.round((LOW_H * cssW) / Math.max(1, cssH));
  return { w: Math.max(216, Math.min(480, w)), h: LOW_H };
}

const out = document.getElementById("screen") as HTMLCanvasElement;
const low = document.createElement("canvas");
const g = low.getContext("2d")!;
const presenter = makePresenter(out);
const scene = new Overworld();
const keys = new Set<string>();
const CRT_KEY = "mw.crt";
let crt = (() => {
  try {
    return localStorage.getItem(CRT_KEY) !== "0";
  } catch {
    return true;
  }
})();
let hint = 6; // seconds the first hint stays up

function resize(): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  out.width = Math.round(window.innerWidth * dpr);
  out.height = Math.round(window.innerHeight * dpr);
  const s = lowSize(window.innerWidth, window.innerHeight);
  low.width = s.w;
  low.height = s.h;
  g.imageSmoothingEnabled = false;
}

function setCrt(on: boolean): void {
  crt = on;
  try {
    localStorage.setItem(CRT_KEY, on ? "1" : "0");
  } catch {
    /* private mode: setting just isn't remembered */
  }
  crtBtn.textContent = on ? "CRT on" : "CRT off";
}

const crtBtn = document.getElementById("crt") as HTMLButtonElement;
crtBtn.addEventListener("click", () => setCrt(!crt));
setCrt(crt);

window.addEventListener("resize", resize);
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === "c" && !e.repeat) setCrt(!crt);
  keys.add(k);
  if (k.startsWith("arrow")) e.preventDefault();
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => keys.clear());
resize();

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt, now / 1000);
  requestAnimationFrame(frame);
}

function update(dt: number, t: number): void {
  scene.update(dt, keys);
  scene.draw(g, low.width, low.height, t);
  if (hint > 0) {
    hint -= dt;
    drawDialogue(g, low.width, low.height, "Walk with WASD or the arrow keys. Press C to switch the CRT look.", "Hint");
  }
  presenter.present(low, crt ? 1 : 0);
}

// Fonts must be ready before the first text sprite is cached.
document.fonts.load('8px "Press Start 2P"').finally(() => requestAnimationFrame(frame));

// Dev hook: drive frames by hand when the tab is hidden (rAF stalls there).
(window as unknown as { __px: unknown }).__px = { scene, update, keys, setCrt };
