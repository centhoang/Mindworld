// /lab/visual: the mosaic view on fixed scenes, with no model and no room. Keys 1-5 pick a preset, N toggles night.
import type { Scene, SceneBattle } from "../game/ports";
import { phaseOf } from "../life/clock";
import { buildTileMap } from "../world/tilemap";
import { villageWorld } from "../world/village-map";
import { MosaicView } from "../view/mosaic/mosaic-view";

const canvas = document.querySelector("canvas")!;
const g = canvas.getContext("2d")!;
const view = new MosaicView();
const world = villageWorld({ me: { seed: 1, slot: 0 }, others: [{ id: "a", name: "Ana", seed: 2, slot: 1 }] });
const map = buildTileMap(world);
const home = world.platforms.find((p) => p.kind === "home")!;
const look = (hair: string, tool: string) => ({ hair, tool }) as Scene["people"][number]["look"];
const genes = (hue: number, ears: number, build: number) => ({ hue, ears, build }) as NonNullable<Scene["pets"][number]["genes"]>;
const person = (id: string, name: string, x: number, z: number, hair: string, tool = "hands", kind: "me" | "npc" = "npc") => ({ id, name, kind, x, z, dir: 0 as const, walking: false, pose: null, look: look(hair, tool) });
const things = (world.things ?? []).map((t) => ({ kind: t.kind, x: t.x, z: t.z }));
const beds = [0, 1, 2, 3, 4, 5].map((i) => ({ x: home.x + 3 + (i % 3), z: home.z - 2 + (i >> 2) * 2, crop: "wheat", stage: i % 4, wet: i === 1, dry: i === 2 }));

const base = (hour: number): Scene => ({
  map, cam: { x: 0, z: 2 }, indoors: false, clock: { day: 1, hour, phase: phaseOf(hour), label: "Lab" }, day: false, showNames: true, showMap: false,
  people: [person("me", "You", 1, 3, "bowlhair", "hands", "me"), person("mo", "Mo", -3, 2, "curlyhair", "rod"), person("ama", "Ama", 3, 2, "longhair", "hands"), person("pip", "Pip", 0, 5, "spikeyhair", "watering")],
  pets: [{ id: "pet", kind: "mine", x: 2.2, z: 3.4, genes: genes(0.5, 0.2, 0.3), pose: null }, { id: "w", kind: "wild", x: -5, z: 4, genes: genes(0.9, 0.8, 0.8), pose: null }],
  props: [...things, { kind: "stall", x: -7, z: -3 }, { kind: "board", x: 5, z: -3 }, { kind: "well", x: 7, z: 3 }, { kind: "statue", x: -6.5, z: 4 }, { kind: "home", x: home.x, z: home.z - 2.5 }, { kind: "bowl", x: home.x - 2, z: home.z - 0.9 }],
  beds, bubbles: [{ id: "ama", x: 3, z: 2, head: "Ama", text: "Fish is cheap today, come by the stall.", thought: false, first: true }], hint: "E: TALK", banner: null, inspector: null, panels: [],
});

const fighter = (name: string, hp: number, g2: ReturnType<typeof genes>) => ({ name, level: 3, hp, maxHp: 30, genes: g2, dx: 0, flash: false, gone: 0, shield: false });
const battle: SceneBattle = { foe: fighter("BRUTE", 18, genes(0.4, 0.9, 0.6)), mine: fighter("MOCHI", 24, genes(0.7, 0.2, 0.3)), slide: 1, hearts: 0, text: "What will Mochi do?", lines: (w) => ["What will Mochi do?".slice(0, w)], tag: "", menu: { labels: ["Fight", "Teach", "Swap", "Run"], cursor: 1 } };

let preset = 1, night = false;
addEventListener("keydown", (e) => {
  if (e.key >= "1" && e.key <= "5") preset = Number(e.key);
  if (e.key.toLowerCase() === "n") night = !night;
});

function frame(ms: number): void {
  const t = ms / 1000, w = Math.ceil(innerWidth / 2 / 8) * 8, h = Math.ceil(innerHeight / 2 / 8) * 8;
  if (canvas.width !== w || canvas.height !== h) {
    [canvas.width, canvas.height] = [w, h];
    canvas.style.cssText = `width:${w * 2}px;height:${h * 2}px`;
  }
  const s = base(night ? 23 : 12);
  if (preset === 1) view.draw(s, g, w, h, t);
  if (preset === 2) view.draw({ ...s, cam: { x: home.x + 2, z: home.z - 1 }, people: [person("me", "You", home.x + 2, home.z + 1, "bowlhair", "hands", "me")], bubbles: [] }, g, w, h, t);
  if (preset === 3) view.draw({ ...s, cam: { x: 20, z: -10 }, people: [person("mo", "Mo", 20, -11, "curlyhair", "rod")], bubbles: [] }, g, w, h, t);
  if (preset === 4) view.battle(battle, g, w, h, t);
  if (preset === 5) view.draw({ ...s, panels: [{ place: "middle", title: "Town board", rows: [{ label: "Fish", note: "4c" }, { label: "Wheat", note: "2c" }], cursor: 0, footer: "Esc: close" }] }, g, w, h, t);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
