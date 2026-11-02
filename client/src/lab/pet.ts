// /lab/pet: Teach and Prove on the plane, above a row of wild varieties. It reads your pet's save and never writes it.
import { petLook, randomGenes } from "../game/genes";
import type { Scene, ScenePet } from "../game/ports";
import { load } from "../game/save";
import { WebLlmVoice } from "../game/voices";
import { phaseOf } from "../life/clock";
import { loadArt } from "../pixel/art";
import { drawMonster } from "../pixel/monster";
import { TeachScreen } from "../pixel/teach";
import { MosaicView } from "../view/mosaic/mosaic-view";
import { buildTileMap } from "../world/tilemap";
import { villageWorld } from "../world/village-map";

const W = 480, H = 360, SCALE = 2;
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
const view = new MosaicView();
const map = buildTileMap(villageWorld({}));
const varieties: ScenePet[] = Array.from({ length: 8 }, (_, i) => ({ id: `w${i}`, kind: "wild", x: -10 + i * 2.9, z: -3, genes: randomGenes(i * 37 + 5), pose: null }));
const scene = (t: number): Scene => ({
  map, cam: { x: 0, z: 2 }, indoors: false, clock: { day: 1, hour: 12, phase: phaseOf(12), label: "Pet lab" }, day: true, showNames: false, showMap: false,
  people: [], pets: [...varieties, { id: "pet", kind: "mine", x: 0, z: 9, genes: state.genes, pose: null }], props: [], beds: [], bubbles: [], hint: null, banner: null, inspector: null,
  panels: [{ ...teach.panel(t), place: "bottom" }],
});
const frame = (now: number) => {
  if (!teach.open) teach.show();
  view.draw(scene(now / 1000), g, W, H, now / 1000);
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
