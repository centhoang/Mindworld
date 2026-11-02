// /lab/pet: the Teach and Prove screen on its own. It reads your pet's save and never writes it.
import { petLook } from "../game/genes";
import { load } from "../game/save";
import { WebLlmVoice } from "../game/voices";
import { loadArt } from "../pixel/art";
import { drawMonster } from "../pixel/monster";
import { TeachScreen } from "../pixel/teach";

const W = 384, H = 216, SCALE = 2;
const state = load();
const portrait = drawMonster(petLook(state.genes), 48, "front");
const brain = new WebLlmVoice();
let loaded = false;
const teach = new TeachScreen({
  memo: () => state.memo,
  recent: () => state.recent,
  setMemo: (m) => void (state.memo = m),
  petName: () => "Mochi",
  browserCoach: () => (loaded ? (req) => brain.completeJson(req) : null),
  portrait: () => portrait,
});
teach.show();

const canvas = document.getElementById("screen") as HTMLCanvasElement;
[canvas.width, canvas.height] = [W, H];
canvas.style.width = `${W * SCALE}px`;
const g = canvas.getContext("2d")!;
g.imageSmoothingEnabled = false;
const frame = (now: number) => {
  if (!teach.open) teach.show();
  teach.draw(g, W, H, now / 1000);
  requestAnimationFrame(frame);
};
void loadArt().then(() => requestAnimationFrame(frame));

const loadBtn = document.getElementById("load") as HTMLButtonElement;
const statusEl = document.getElementById("status")!;
loadBtn.onclick = () => {
  loadBtn.disabled = true;
  void brain.load((_text, frac) => (statusEl.textContent = `Loading: ${Math.round(100 * frac)}%`)).then(() => {
    loaded = true;
    statusEl.textContent = "Model ready";
  }, (e: unknown) => {
    loadBtn.disabled = false;
    statusEl.textContent = `Could not load: ${String(e).slice(0, 100)}`;
  });
};
