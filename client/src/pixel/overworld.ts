// The top-down overworld scene: tile map, trees, the player and the following pet, a pixel-snapped follow
// camera and the place banner. Game rules (movement, the map) come from ../world; this file only decides
// what is where on screen.

import { generateWorld, groundOrigin, onGround, platformAt, worldDay, type LayoutInput, type Platform, type WorldMap } from "../world/layout";
import { followStep, keyDir, slide, stepToward, WALK_SPEED, type Vec } from "../world/movement";
import { petLook, randomGenes } from "../game/genes";
import type { Genes } from "../sim/ghost";
import { ARCHETYPES, type ArchetypeId } from "../sim/types";
import { hasArt, img, makePlayer, PAL, spriteFrame, type ArtName, type Sprite } from "./art";
import { drawDecor, drawSpotProp } from "./grounds-draw";
import { placeDecor, type DecorPiece } from "./grounds-decor";
import { needsWater, PLOTS, type Farm } from "../game/farm";
import { BUILDS, drawMonster } from "./monster";
import { drawFrame, drawText, drawTinyText, GLYPH, wrap } from "./text";
import { AWAY, buildTileMap, hash2, lookAt, T, TILE, tileWalkable, type TileMap } from "./tiles";
import { buildSunny, characterShadow, drawCropArt, drawHighClouds, drawLand, drawLowClouds, drawSea, drawTree, stampSize, stand, strip, type SunnyWorld } from "./sunny";
import { ACTIVITY } from "../life/activities";
import { clockLabel, gameTime, phaseOf, weekday, worldSeconds } from "../life/clock";
import { addAgent, cleanMess, newVillage, removeAgent, stepVillage, type Agent, type Env, type Spots } from "../life/village";
import { mulberry32 } from "../sim/rng";
import { findRoute } from "../world/route";
import { railBlocks } from "./sunny-terrain";
import { layoutBubbles, type BubbleBox, type Placed } from "./bubbles";
import { liveName } from "../world/live";
import { drawBall, drawBowl, drawPetPose, drawPoop, drawTint, sitFrame } from "./life-draw";
import { MindHub, type MindsSave } from "../mind/hub";
import { petPersona } from "../mind/persona";
import type { MindScheduler } from "../mind/scheduler";
import { drawInspector } from "./inspector";
import { isNpc, NPCS, type MindLine, type Npc } from "../world/live";
import { NpcVillage } from "../mind/npcs";
import { petScene, sharedScene, type Seen } from "../mind/scene";
import { generatedSprites, SpriteImages } from "./generated-sprites";
import { HUMAN_RUN_SPEED, HUMAN_WALK_SPEED, humanLook, humanSprites, newHumanMotion, NPC_LOOKS, stepHumanMotion, type HumanLook, type HumanMotion } from "./humans";

const CLUMP = 6; // tiles: trees gather in cells of this size
const SHORE: readonly (readonly [number, number])[] = [[-2, 0], [2, 0], [-1, 0], [1, 0], [0, -2], [-2, 1], [2, 1], [0, 1], [0, 2], [0, 3], [-2, 3], [2, 3]];
// The mouth of each house's chimney, in pixels from the stamp's top left. Houses not listed have none.
const CHIMNEY: Record<string, [number, number]> = { "house-blue": [63, 11], "house-red": [15, 1], "house-orange": [15, 22], "house-orangelong": [63, 18], "house-bluesmall": [55, 7] };
const SMOKE_W = 15;
const SMOKE_H = 37;
const READ_CHARS = 12; // a bubble stays long enough to read at this many characters a second
const xz = (v: Vec) => ({ x: v.x, z: v.z });
export const NAME_MAX = 10;
const DECOR_NAME: Record<DecorPiece["kind"], string> = { stump: "a tree stump", jar: "a clay jar", bush: "a bush", "bush-big": "a big bush", rock: "a rock", "rock-big": "a big rock", fence: "a fence", lights: "party lights" };
const SPOT_NAME: Partial<Record<keyof Spots, string>> = { bed: "a bed", lawn: "the lawn", playground: "the playground slide and goal", picnic: "the picnic blanket", pond: "the fishing pond", plaza: "the village square" };

export const OVERWORLD_MON = 20; // px: monsters in the overworld
const WILD_PER_MEADOW = 3;
const MEET_DIST = 1.0;
const NPC_ROUTE_TILES = 120_000; // the NPCs may walk across the whole map
const HOME_ART = "house-blue";
const HOUSE_ART = ["house-red", "house-orange", "house-green", "house-purple", "house-orangelong", "house-redsmall", "house-bluesmall", "house-greentall"];
const CROP_ART: Record<string, string> = { wheat: "wheat", carrot: "carrot", tomato: "radish" };
// Farm stages 0-3 onto the pack's six growth pictures.
const CROP_STAGE = [1, 2, 3, 5];

// Fixed buildings and big pieces on shared places: solid, and drawn with the people.
interface Landmark {
  art: string;
  x: number;
  z: number;
}
const CRITTERS = ["spr_deco_chicken_01_strip4", "spr_deco_sheep_01_strip4", "spr_deco_pig_01_strip4", "spr_deco_cow_strip4"];

export interface Wild {
  id: number;
  arch: ArchetypeId;
  genes: Genes;
  sprite: HTMLCanvasElement;
  pos: Vec;
  home: Vec;
  target: Vec;
  wait: number;
  cool: number; // seconds before it can start a fight (after one just ended)
}

// Owned pets that are not out with you live at your corner as minds in the life sim (life/village.ts):
// they get hungry, eat at the bowl, nap, play ball together and leave poop for you to clean.
interface Resident {
  sprite: HTMLCanvasElement;
  agent: Agent;
  genes: Genes;
}

export class Overworld {
  world!: WorldMap;
  map!: TileMap;
  trees: Vec[] = [];
  private readonly treeTiles = new Set<number>();
  decor: DecorPiece[] = []; // bushes, rocks, fences, party lights (seeded, grounds-decor.ts)
  private readonly decorTiles = new Set<number>();
  private layoutIn: LayoutInput;
  houses: (Vec & { art: string })[] = []; // other players' houses (props only; yours is `house`)
  private landmarks: Landmark[] = [];
  private critters: { art: string; x: number; z: number; seed: number }[] = [];
  private sunny!: SunnyWorld;
  ui = { names: true, map: true }; // the small buttons (main.ts)
  alwaysDay = false; // dev hook: screenshots at any hour
  player: Vec = { x: 0, z: 0 };
  pet: Vec = { x: 0, z: 0 };
  private moving = false;
  private readonly playerMotion = newHumanMotion(this.player);
  private readonly npcMotions = new Map<Npc, HumanMotion>();
  private readonly npcPets = new Map<Npc, Vec>();
  private readonly npcPetImages = new SpriteImages();
  private place = "";
  private bannerT = 0;
  private sprite: Sprite | null = null;
  private get playerSprite(): Sprite {
    return (this.sprite ??= makePlayer()); // after loadArt: the ImageGen walk sheet
  }
  petSprite: HTMLCanvasElement;
  readonly wilds: Wild[] = [];
  private nextId = 1;
  private residents: Resident[] = [];
  readonly life = newVillage();
  private lifeEnv: Env;
  bowl: Vec = { x: 0, z: 0 };
  minds: MindHub | null = null;
  npcs: NpcVillage | null = null; // Elder, Mo, Ama, Pip on the hub (their minds run on whoever hosts them)
  private npcSprites = new Map<Npc, Sprite>();
  private signs: { x: number; z: number; text: string }[] = []; // owner's name at each ground's hub-side gate
  private mini: HTMLCanvasElement | null = null; // the whole map, 1 px per tile (rebuilt on relayout)
  private savedMinds: MindsSave | null = null;
  inspect: string | null = null; // the mind shown in the inspector (I)
  mindWhere = "this computer";
  myName = "a visitor"; // set by main.ts (the live name), so villagers can greet me by name
  myLook: HumanLook = humanLook("a visitor"); // from my pet's genes, so renaming keeps my hair
  petName = "your pet"; // the pet following me (main.ts), so villagers can talk to it by name
  cam: Vec = { x: 0, z: 0 };
  house: Vec = { x: 0, z: 0 }; // the A-frame's front-centre (door) at the home plaza
  beds: Vec[] = []; // farm bed tile corners (world units), 3x2 east of the A-frame
  farm: Farm | null = null; // set by main.ts; drawn on the beds
  // The Reader (boss) on its island and the Elder on hers: they stand still; touch the boss to fight it,
  // press E by the Elder to talk.
  boss: { pos: Vec; sprite: HTMLCanvasElement; cool: number } | null = null;
  elder: { pos: Vec; sprite: HTMLCanvasElement } | null = null;
  // The market stall on the market island: E there opens the same buy/sell menu as the crate at home.
  stall: Vec | null = null;
  private noticeBoard: Vec | null = null;
  // The ghost stone on the event island: touch it to fight a random shared ghost.
  ghostStone: { pos: Vec; sprite: HTMLCanvasElement; cool: number } | null = null;
  // Other players online (live room): their walker and pet, eased toward the last position received.
  readonly peers = new Map<string, Peer>();
  // My minds' public moments (activity starts, spoken lines), sent to the live room by main.ts.
  onMind: ((l: MindLine) => void) | null = null;
  // Speech bubbles: "pet", "me", "r<i>" (resident i), "w<id>" (wild pet), "p:<id>" (an online
  // player), "elder", "boss" -> text and seconds left.
  private readonly bubbles = new Map<string, Bubble>();

  constructor(petGenes: Genes, groundSeed = 1) {
    this.layoutIn = { me: { seed: groundSeed, slot: 0 }, roomSeed: 1, day: worldDay() };
    this.petSprite = drawMonster(petLook(petGenes), OVERWORLD_MON, "front");
    this.lifeEnv = { spots: { home: [], bowl: [], bed: [], lawn: [] }, canWalk: this.canWalk, rng: mulberry32(Date.now() % 1e9), route: (a, b) => findRoute(a, b, this.canWalk) };
    this.relayout();
    // A second pass, so trees keep clear of what the first one placed.
    this.relayout();
  }

  // Shared people and pieces follow the map: more of them fill in between grounds as players arrive.
  private placeShared(): void {
    const plaza = this.world.platforms.find((p) => p.kind === "plaza")!;
    this.stall = { x: plaza.x - 7, z: plaza.z - 3 };
    const bossIsle = this.world.platforms.find((p) => p.kind === "boss");
    if (bossIsle) this.boss = { pos: { x: bossIsle.x, z: bossIsle.z - 1 }, sprite: this.boss?.sprite ?? drawMonster(petLook(randomGenes(4242)), 40, "front", BUILDS.bully), cool: this.boss?.cool ?? 0 };
    const eventIsle = this.world.platforms.find((p) => p.kind === "event");
    this.ghostStone = eventIsle ? { pos: { x: eventIsle.x, z: eventIsle.z - 1 }, sprite: this.ghostStone?.sprite ?? ghostSprite(), cool: this.ghostStone?.cool ?? 0 } : null;
    const npcIsle = this.world.platforms.find((p) => p.kind === "npc");
    if (npcIsle) this.elder = { pos: this.elder?.pos ?? { x: npcIsle.x, z: npcIsle.z - 1 }, sprite: this.elder?.sprite ?? drawMonster(petLook(randomGenes(77)), 24, "front", BUILDS.turtle) };
    this.landmarks = [{ art: "spr_deco_well", x: plaza.x + 7, z: plaza.z + 3 }, { art: "statue", x: plaza.x - 6.5, z: plaza.z + 4 }];
    if (npcIsle) this.landmarks.push({ art: "house-purple", x: npcIsle.x, z: npcIsle.z - 3.5 });
    this.critters = [];
    for (const p of this.world.platforms) {
      if (p.kind === "plaza" || p.kind === "islet") continue;
      const n = 1 + Math.floor(hash2(p.cell[0], p.cell[1], 80) * 3);
      for (let k = 0; k < n; k++) {
        const a = hash2(p.cell[0], k, 81) * 6.28;
        const d = 5 + hash2(k, p.cell[1], 82) * 2.5;
        const x = p.x + Math.cos(a) * d;
        const z = p.z + 1 + Math.sin(a) * d;
        if (this.canWalk(x, z)) this.critters.push({ art: CRITTERS[Math.floor(hash2(p.cell[0] * 7, k + p.cell[1], 83) * CRITTERS.length)]!, x, z, seed: k * 3 });
      }
    }
    // Wild pets belong to their meadows: none left on a meadow that went away, three on a new one.
    for (const w of [...this.wilds]) if (!this.canWalk(w.home.x, w.home.z)) this.removeWild(w.id);
    for (const p of this.world.platforms) {
      if (p.kind !== "wild") continue;
      const here = this.wilds.filter((w) => Math.hypot(w.home.x - p.x, w.home.z - p.z) < p.r + 3).length;
      for (let i = here; i < WILD_PER_MEADOW; i++) this.spawnWild(p.x, p.z, p.r);
    }
  }

  get home(): Platform {
    return this.world.platforms.find((p) => p.kind === "home")!;
  }

  get day(): number {
    return this.layoutIn.day ?? 0;
  }

  // Rebuild the map from who holds which slot (live room), the room seed and the shared day. Your ground
  // may move (the room gave you a slot): your pets, their mess and you (if you were home) move with it.
  relayout(next: Partial<LayoutInput> = {}): void {
    const old = this.world ? this.home : null;
    const wasHome = !!old && onGround(old, this.player.x, this.player.z);
    this.layoutIn = { ...this.layoutIn, ...next };
    this.world = generateWorld(this.layoutIn);
    this.map = buildTileMap(this.world);
    this.sunny = buildSunny(this.map);
    const plaza = this.world.platforms.find((p) => p.kind === "plaza");
    this.noticeBoard = plaza ? { x: plaza.x + 5, z: plaza.z - 3 } : null;
    this.mini = null;
    const home = this.home;
    const dx = old ? home.x - old.x : 0;
    const dz = old ? home.z - old.z : 0;
    this.house = { x: home.x, z: home.z - 2.5 };
    this.houses = this.world.platforms.filter((p) => p.kind === "ground").map((p) => ({ x: p.x, z: p.z - 2.5, art: HOUSE_ART[(p.ground?.seed ?? 0) % HOUSE_ART.length]! }));
    this.beds = Array.from({ length: PLOTS }, (_, i) => ({ x: Math.floor(home.x) + 5 + (i % 3), z: Math.floor(home.z) - 4 + Math.floor(i / 3) * 2 }));
    this.trees = [];
    this.treeTiles.clear();
    this.decor = [];
    this.decorTiles.clear();
    this.placeShared();
    this.placeTrees();
    this.placeSigns();
    this.placeDecor();
    this.bowl = { x: this.house.x - 5, z: this.house.z + 1.6 };
    const lawn: Vec[] = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const d = 4 + (i % 3) * 1.4;
      const q = { x: home.x + Math.cos(a) * d, z: home.z + 1 + Math.sin(a) * d };
      if (this.canWalk(q.x, q.z)) lawn.push(q);
    }
    this.lifeEnv.spots = {
      home: [{ x: home.x, z: home.z + 2 }],
      bowl: [{ x: this.bowl.x, z: this.bowl.z + 0.5 }, { x: this.bowl.x - 0.8, z: this.bowl.z + 0.2 }],
      bed: [{ x: this.house.x - 2, z: this.house.z + 1.2 }, { x: this.house.x + 2, z: this.house.z + 1.2 }, { x: this.house.x - 2.6, z: this.house.z + 1.8 }],
      lawn,
      ...this.betweenSpots([home.cell]),
    };
    this.npcs?.setSpots(this.npcSpots());
    this.minds?.setPlaces(new Set(Object.keys(this.lifeEnv.spots) as (keyof Spots)[]));
    if (dx || dz) {
      const move = (v: Vec) => {
        v.x += dx;
        v.z += dz;
      };
      for (const a of this.life.agents) (move(a.pos), move(a.target), a.path?.forEach(move));
      for (const m of this.life.messes) move(m.pos);
      for (const g of this.life.gatherings) move(g.at);
      if (wasHome) [this.player, this.pet, this.cam].forEach(move);
    }
    // Standing on a ground that just went away (a ghost slot freed, the day's playground moved): go home.
    if (!old || !this.canWalk(this.player.x, this.player.z)) {
      this.player = { x: home.x + 0.5, z: home.z + 3.5 };
      this.pet = { x: home.x - 1, z: home.z + 4 };
      this.cam = { ...this.player };
    }
    if (!this.canWalk(this.pet.x, this.pet.z)) this.pet = { x: this.player.x - 0.8, z: this.player.z + 0.5 };
  }

  // In-between grounds bridged to my ground (picnic hill, playground, pond): my minds may walk there for
  // group activities, so invitations to a picnic can actually happen. Spots ring the prop on free land.
  // `cells` = the platforms they must touch; `reach` instead = any in-between ground with a walking route
  // from that point (the NPCs walk the whole map: Mo goes fishing at whichever pond exists).
  private betweenSpots(cells: readonly [number, number][], reach?: Vec): Spots {
    const out: Spots = {};
    const anchor: Record<string, [keyof Spots, string]> = { picnic: ["picnic", "blanket"], playground: ["playground", "ball"], pond: ["pond", "dock"] };
    for (const p of this.world.platforms) {
      const use = p.spots?.pond ? anchor.pond : anchor[p.kind];
      if (!use || !p.spots) continue;
      const at = p.spots[use[1]]!;
      const touches = cells.some(([hi, hj]) => Math.abs(p.cell[0] - hi) + Math.abs(p.cell[1] - hj) === 1);
      if (!touches && !(reach && findRoute(reach, { x: at.x, z: at.z + 1 }, this.canWalk, NPC_ROUTE_TILES))) continue;
      const list = (out[use[0]] ??= []);
      if (p.spots.pond) list.push({ ...at });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const q = { x: at.x + Math.cos(a) * 1.6, z: at.z + 0.8 + Math.sin(a) * 1.2 };
        if (this.canWalk(q.x, q.z)) list.push(q);
      }
      if (!list.length) delete out[use[0]];
    }
    return out;
  }

  // The NPCs live on the hub: beds on the Elder's island, dancing and picnics on the plaza, and any
  // in-between ground bridged to the hub (Mo fishes at a pond there).
  private npcSpots(): Spots {
    const hub = this.world.platforms.filter((p) => !p.ground && Math.max(Math.abs(p.cell[0]), Math.abs(p.cell[1])) <= 1);
    const plaza = hub.find((p) => p.kind === "plaza");
    const isle = hub.find((p) => p.kind === "npc");
    const ring = (c: Platform | undefined, r: number, n: number, dz = 0) =>
      c ? Array.from({ length: n }, (_, i) => ({ x: c.x + Math.cos((i / n) * Math.PI * 2) * r, z: c.z + dz + Math.sin((i / n) * Math.PI * 2) * r * 0.8 })).filter((q) => this.canWalk(q.x, q.z)) : [];
    const away = this.betweenSpots(hub.map((p) => p.cell), plaza ? { x: plaza.x, z: plaza.z + 2 } : undefined);
    // Keep dance feet within the 6x4 logical-tile floor centred on the plaza.
    const out: Spots = { ...away, home: ring(isle, 1.5, 4), bed: ring(isle, 2.2, 6, 1), lawn: ring(plaza, 2.4, 10), picnic: [...ring(plaza, 2, 6, 2), ...(away.picnic ?? [])], woods: ring(plaza, 5.5, 10) };
    if (this.stall) out.stall = [{ x: this.stall.x, z: this.stall.z + 1.2 }];
    for (const k of Object.keys(out) as (keyof Spots)[]) if (!out[k]!.length) delete out[k];
    return out;
  }

  private npcHomes(): Record<Npc, Vec> {
    const isle = this.world.platforms.find((p) => p.kind === "npc") ?? { x: 0, z: 0 };
    return { elder: { x: isle.x, z: isle.z - 1 }, mo: { x: -3, z: 2 }, ama: { x: 3, z: 2 }, pip: { x: 0, z: 4 } };
  }

  // A name sign beside the gate that faces the hub, on whichever side of the path is free land.
  private placeSigns(): void {
    this.signs = [];
    for (const p of this.world.platforms) {
      if (!p.ground) continue;
      const [ci, cj] = p.cell;
      const side = Math.abs(ci) >= Math.abs(cj) ? (ci > 0 ? "w" : "e") : cj > 0 ? "n" : "s";
      const [ox, oz] = groundOrigin(p);
      const gate = p.ground.gates[side];
      const inX = side === "w" ? 2 : side === "e" ? -2 : 0; // a couple of tiles inside the gate
      const inZ = side === "n" ? 2 : side === "s" ? -2 : 0;
      const x0 = ox + gate.i + 0.5 + inX;
      const z0 = oz + gate.j + 0.5 + inZ;
      const name = p.owner === "me" ? "HOME" : p.label.replace(/'s ground.*$/, "").toUpperCase();
      for (const d of [1.6, -1.6]) {
        const at = inX ? { x: x0, z: z0 + d } : { x: x0 + d, z: z0 };
        if (!this.canWalk(at.x, at.z)) continue;
        this.signs.push({ ...at, text: name.slice(0, 12) });
        break;
      }
    }
  }

  // A house with its chimney smoke.
  private drawHouse(g: CanvasRenderingContext2D, art: string, x: number, y: number, t: number): void {
    stand(g, art, x, y);
    const top = CHIMNEY[art];
    if (!top) return;
    const [w, h] = stampSize(art);
    strip(g, "chimneysmoke_01_strip30", x - w / 2 + top[0] - SMOKE_W / 2, y - h + top[1] - SMOKE_H + 3, Math.floor(t * 10));
  }

  // A small name over every person, players and villagers alike.
  private drawNames(g: CanvasRenderingContext2D, toScreen: (x: number, z: number) => [number, number], sw: number, sh: number): void {
    const tag = (name: string, pos: Vec) => {
      const [x, y] = toScreen(pos.x, pos.z);
      if (x < -30 || y < 0 || x > sw + 30 || y > sh + 30) return;
      drawTinyText(g, name, Math.round(x), y - 28);
    };
    tag(this.myName, this.player);
    for (const p of this.peers.values()) tag(p.name, p.pos);
    for (const a of this.npcs?.v.agents ?? []) tag(a.name, a.pos);
  }

  // Top-right map of the islands: land, paths and bridges, my ground, other players and me.
  private drawMinimap(g: CanvasRenderingContext2D, sw: number): void {
    const m = this.map;
    if (!this.mini) {
      const c = document.createElement("canvas");
      [c.width, c.height] = [m.w, m.h];
      const cg = c.getContext("2d")!;
      const away = (k: number) => (m.look[k]! & AWAY) !== 0;
      for (let k = 0; k < m.w * m.h; k++) {
        const t = m.kind[k]!;
        if (t === T.water) continue;
        cg.fillStyle = t === T.path || t === T.bridge ? PAL.sand : away(k) ? PAL.stone : PAL.grass;
        cg.fillRect(k % m.w, Math.floor(k / m.w), 1, 1);
      }
      this.mini = c;
    }
    const size = 52;
    const k = size / Math.max(m.w, m.h);
    const x0 = sw - size - 6;
    const y0 = 18;
    g.fillStyle = PAL.waterD;
    g.fillRect(x0 - 2, y0 - 2, size + 4, size + 4);
    g.imageSmoothingEnabled = true;
    g.drawImage(this.mini, x0 + (size - m.w * k) / 2, y0 + (size - m.h * k) / 2, m.w * k, m.h * k);
    g.imageSmoothingEnabled = false;
    const dot = (x: number, z: number, c: string, r = 2) => {
      g.fillStyle = c;
      g.fillRect(Math.round(x0 + (size - m.w * k) / 2 + (x - m.ox) * k - r / 2), Math.round(y0 + (size - m.h * k) / 2 + (z - m.oz) * k - r / 2), r, r);
    };
    dot(this.house.x, this.house.z + 2, PAL.woodD, 4);
    for (const p of this.peers.values()) dot(p.pos.x, p.pos.z, PAL.teal, 3);
    dot(this.player.x, this.player.z, PAL.coral, 3);
  }

  // Trees ring each island inside the sand, never on paths, plazas or bridges, and never in a 2-tile gap.
  private placeTrees(): void {
    const m = this.map;
    const kindAt = (i: number, j: number) => i < 0 || j < 0 || i >= m.w || j >= m.h ? T.water : m.kind[j * m.w + i];
    for (const p of this.world.platforms) {
      if (p.kind === "islet") continue;
      const rng = mulberry32((p.ground?.seed ?? Math.floor(hash2(...p.cell, 10) * 2 ** 32)) ^ 0x71ee);
      const [x0, z0] = p.ground ? groundOrigin(p) : [Math.floor(p.x - p.r), Math.floor(p.z - p.r)];
      const [w, h] = p.ground ? [p.ground.w, p.ground.h] : [Math.ceil(p.r * 2), Math.ceil(p.r * 2)];
      const candidates: Vec[] = [];
      for (let j = z0 - m.oz; j < z0 - m.oz + h; j++) for (let i = x0 - m.ox; i < x0 - m.ox + w; i++) {
        const k = m.kind[j * m.w + i];
        if (k !== T.grass && k !== T.tall) continue;
        const x = m.ox + i + 0.5;
        const z = m.oz + j + 0.5;
        if (platformAt(this.world, x, z)?.id !== p.id) continue;
        // Trees stand well inland (canopies must not hang over a cliff) and grow in clumps, as in the pack's scenes.
        if (SHORE.some(([di, dj]) => { const c = kindAt(i + di, j + dj); return c === T.water || c === T.pool || c === T.bridge; })) continue;
        if (p.ground && Math.hypot((x - p.x) / 7.5, (z - p.z + 1) / 5) < 1) continue;
        if (p.spots && Object.values(p.spots).some((s) => Math.abs(s.x - x) < 3.5 && Math.abs(s.z - z) < 3.5)) continue;
        if (p.kind === "plaza" && Math.abs(x - p.x) < 4 && Math.abs(z - p.z) < 3) continue;
        if (this.noticeBoard && Math.abs(x - this.noticeBoard.x) < 2 && Math.abs(z - this.noticeBoard.z) < 2) continue;
        if (this.houses.some((hs) => Math.abs(x - hs.x) < 5 && Math.abs(z - hs.z + 2) < 5)) continue;
        if (this.nearPath(i, j)) continue;
        if (Math.abs(x - this.house.x) < 6 && Math.abs(z - this.house.z + 2) < 6) continue;
        if (this.stall && Math.abs(x - this.stall.x) < 3.5 && Math.abs(z - this.stall.z + 1) < 3.5) continue;
        if (this.landmarks.some((l) => Math.abs(x - l.x) < 3.5 && Math.abs(z - l.z + 1) < 3.5)) continue;
        if (this.beds.some((b) => Math.abs(b.x + 0.5 - x) < 2.5 && Math.abs(b.z + 0.5 - z) < 2.5)) continue;
        candidates.push({ x, z });
      }
      // Shuffle once per platform, then grow compact patches with trees about two tiles apart. The draw code's
      // position hash continues to mix the existing tree kinds. No isolated outliers fill the gaps.
      for (let n = candidates.length - 1; n > 0; n--) {
        const q = Math.floor(rng() * (n + 1));
        [candidates[n], candidates[q]] = [candidates[q]!, candidates[n]!];
      }
      const clumps = 2 + Math.floor(rng() * 2);
      for (let c = 0; c < clumps; c++) {
        const want = 5 + Math.floor(rng() * 5);
        const available = candidates.filter((v) => !this.trees.some((t) => Math.abs(t.x - v.x) < 3 && Math.abs(t.z - v.z) < 3));
        let best: Vec[] = [];
        for (const anchor of available) {
          const patch = available.filter((v) => Math.abs(v.x - anchor.x) <= CLUMP && Math.abs(v.z - anchor.z) <= CLUMP)
            .sort((a, b) => Math.hypot(a.x - anchor.x, a.z - anchor.z) - Math.hypot(b.x - anchor.x, b.z - anchor.z));
          const group: Vec[] = [anchor];
          while (group.length < want) {
            const v = patch.find((q) => group.every((t) => Math.max(Math.abs(t.x - q.x), Math.abs(t.z - q.z)) >= 2) && group.some((t) => Math.max(Math.abs(t.x - q.x), Math.abs(t.z - q.z)) === 2));
            if (!v) break;
            group.push(v);
          }
          if (group.length > best.length) best = group;
          if (best.length === want) break;
        }
        // Crowded islands may have less room; clearances take priority over the target count.
        if (best.length < 2) break;
        for (const t of best) {
          this.trees.push(t);
          this.treeTiles.add(Math.floor(t.z - m.oz) * m.w + Math.floor(t.x - m.ox));
        }
      }
    }
  }

  // Decor keeps clear of houses, beds, the stall, trees and name signs (they take part in the walk check).
  private placeDecor(): void {
    const m = this.map;
    const near = (v: Vec, x: number, z: number, d: number) => Math.abs(v.x - x) < d && Math.abs(v.z - z + 1) < d;
    this.decor = placeDecor(this.world, m, (x, z) =>
      [this.house, ...this.houses].some((h) => near(h, x, z, 5)) ||
      this.landmarks.some((l) => near(l, x, z, 3)) ||
      (!!this.stall && near(this.stall, x, z, 3)) ||
      this.beds.some((b) => Math.abs(b.x + 0.5 - x) < 2 && Math.abs(b.z + 0.5 - z) < 2) ||
      this.signs.some((sg) => Math.abs(sg.x - x) < 1.5 && Math.abs(sg.z - z) < 1.5) ||
      this.treeTiles.has(Math.floor(z - m.oz) * m.w + Math.floor(x - m.ox)),
    );
    for (const d of this.decor) for (const k of d.tiles) this.decorTiles.add(k);
  }

  private nearPath(i: number, j: number): boolean {
    const m = this.map;
    for (let dj = -2; dj <= 2; dj++)
      for (let di = -2; di <= 2; di++) {
        const k = m.kind[(j + dj) * m.w + (i + di)];
        if (k === T.path || k === T.bridge) return true;
      }
    return false;
  }

  // Mo, Ama and Pip: their own sheets (npc-*.png) through the player's frame builder, else the player's
  // sheet hue-shifted.
  private npcSprite(id: Npc): Sprite {
    let s = this.npcSprites.get(id);
    if (s) return s;
    const own = `npc-${id}` as ArtName;
    if (hasArt(own)) {
      s = makePlayer(own); // Codex body + the code-drawn walk frames
      this.npcSprites.set(id, s);
      return s;
    }
    const base = this.playerSprite;
    const c = document.createElement("canvas");
    [c.width, c.height] = [base.img.width, base.img.height];
    const g = c.getContext("2d")!;
    g.filter = `hue-rotate(${({ mo: 180, ama: 300, pip: 90 } as Record<string, number>)[id] ?? 0}deg)`;
    g.drawImage(base.img, 0, 0);
    s = { ...base, img: c };
    if (hasArt("player-walk")) this.npcSprites.set(id, s); // the drawn fallback is replaced once the art loads
    return s;
  }

  setPet(g: Genes, arch?: ArchetypeId): void {
    this.petSprite = drawMonster(petLook(g), OVERWORLD_MON, "front", arch ? BUILDS[arch] : undefined);
  }

  // Keeps each resident's mind (needs, plan, friends) across party swaps; ids are the pets' names.
  setResidents(mons: readonly { name?: string; genes: Genes; arch?: ArchetypeId }[]): void {
    const home = this.world.platforms.find((p) => p.kind === "home")!;
    const ids = mons.map((m, i) => m.name ?? `pet${i}`);
    for (const a of [...this.life.agents]) if (a.kind === "pet" && !ids.includes(a.id)) removeAgent(this.life, a.id);
    this.residents = mons.map((m, i) => {
      const id = ids[i]!;
      const ang = (i / Math.max(1, mons.length)) * Math.PI * 2 + 0.6;
      const agent = this.life.agents.find((a) => a.id === id) ?? addAgent(this.life, id, id, "pet", { x: home.x + Math.cos(ang) * 5.5, z: home.z + Math.sin(ang) * 5.5 }, this.savedMinds?.minds[id]?.needs);
      return { sprite: drawMonster(petLook(m.genes), OVERWORLD_MON, "front", m.arch ? BUILDS[m.arch] : undefined), agent, genes: m.genes };
    });
    this.syncMinds();
  }

  // Gives every resident a mind on this machine (persona from genes, memory from the save) and lets the
  // hub choose their activities through the one model queue.
  attachMinds(sched: MindScheduler, hasModel: () => boolean, saved: MindsSave | null): void {
    this.savedMinds = saved;
    if (saved) {
      for (const [k, v] of saved.rel) this.life.rel.set(k, v);
      for (const a of this.life.agents) {
        const n = saved.minds[a.id]?.needs;
        if (n) a.needs = { ...n };
      }
    }
    const places = new Set(Object.keys(this.lifeEnv.spots) as (keyof Spots)[]);
    this.minds = new MindHub(this.life, sched, { say: (id, text, to) => this.sayAgent(id, text, to), invite: (id, act) => this.onMind?.({ who: id, invite: { act } }) }, hasModel, places);
    this.lifeEnv.chooser = this.minds.chooser;
    this.lifeEnv.bias = this.minds.bias;
    this.syncMinds();
    this.npcs = new NpcVillage(sched, hasModel, { line: (l) => this.onMind?.(l), say: (id, text, to) => this.say(`n:${id}`, text, text === "..." ? 25 : 5, to), think: (id, text) => this.think(`n:${id}`, text) }, this.npcHomes(), this.npcSpots(), this.canWalk, (a, b) => findRoute(a, b, this.canWalk, NPC_ROUTE_TILES));
    this.npcs.people = () => [{ id: this.npcs?.me ?? "me", name: this.myName, pos: this.player }, ...[...this.peers].map(([id, p]) => ({ id, name: p.name, pos: p.pos }))];
    this.npcs.pets = () => [
      { id: "pet", name: this.petName, pos: this.pet, busy: this.moving },
      ...this.residents.map((r) => ({ id: r.agent.id, name: r.agent.name, pos: r.agent.pos, busy: r.agent.state === "walk" })),
      ...[...this.peers].map(([id, p]) => ({ id: `pet:${id}`, name: `${p.name}'s pet`, pos: p.pet })),
    ];
    this.minds.sceneOf = this.npcs.hub.sceneOf = (id, withPos) => this.sceneFor(id, withPos);
  }

  // Everything a mind could notice on this screen (scene.ts filters it by distance and by who is looking).
  seenThings(): Seen[] {
    const label = (act: string | null) => (act ? ACTIVITY.get(act)?.label : undefined);
    const out: Seen[] = [{ name: this.myName, kind: "person", ...xz(this.player) }, { name: this.petName, kind: "pet", ...xz(this.pet) }];
    for (const [, p] of this.peers) out.push({ name: p.name, kind: "person", ...xz(p.pos) }, { name: `${p.name}'s pet`, kind: "pet", ...xz(p.pet) });
    for (const a of this.npcs?.v.agents ?? []) out.push({ name: a.name, kind: "person", ...xz(a.pos), doing: label(a.act) });
    for (const r of this.residents) out.push({ name: r.agent.name, kind: "pet", ...xz(r.agent.pos), doing: label(r.agent.act) });
    for (const w of this.wilds) out.push({ name: `a wild ${w.arch}`, kind: "pet", ...xz(w.pos) });
    for (const m of this.life.messes) out.push({ name: "a poop", kind: "thing", ...xz(m.pos), petCares: true });
    out.push({ name: "the food bowl", kind: "thing", ...xz(this.bowl), petCares: true }, { name: "your house", kind: "thing", ...xz(this.house) });
    for (const h of this.houses) out.push({ name: "a little house", kind: "thing", ...xz(h) });
    for (const t of this.trees) out.push({ name: "a tree", kind: "thing", ...xz(t) });
    for (const d of this.decor) out.push({ name: DECOR_NAME[d.kind], kind: "thing", x: d.x, z: d.z });
    const spots = { ...this.lifeEnv.spots, ...this.npcSpots() };
    for (const [place, at] of Object.entries(spots) as [keyof Spots, Vec[]][]) {
      const name = SPOT_NAME[place];
      if (name) for (const v of at) out.push({ name, kind: "thing", ...xz(v), petCares: place === "lawn" || place === "bed" });
    }
    if (this.stall) out.push({ name: "the market stall", kind: "thing", ...xz(this.stall) });
    if (this.elder && !this.npcs) out.push({ name: "the Elder", kind: "person", ...xz(this.elder.pos) });
    return out;
  }

  // `withPos` = the one this mind talks to (only what both can see); none = a pet's own small view, or an NPC's.
  sceneFor(id: string, withPos?: { x: number; z: number }): string {
    const me = this.npcs?.v.agents.find((a) => a.id === id) ?? this.life.agents.find((a) => a.id === id);
    if (!me) return "";
    const g = gameTime(this.life.t);
    const place = platformAt(this.world, me.pos.x, me.pos.z)?.label ?? "";
    const when = `${phaseOf(g.hour)} (${clockLabel(g.hour)})`;
    // Not itself, and not the one it talks to (the prompt names them already).
    const others = this.seenThings().filter((s) => s.name !== me.name && !(withPos && s.x === withPos.x && s.z === withPos.z));
    if (me.kind === "pet") return petScene(me.pos, others, place, when);
    return sharedScene(me.pos, withPos ?? me.pos, others, place, when);
  }

  // The scene for a chat between me (the player) and an NPC, as both see it here.
  sceneWithMe(npc: Npc): string {
    return this.sceneFor(npc, this.player);
  }

  // A wild pet's own small view (pets only notice what is close and pet-relevant).
  wildScene(w: Wild): string {
    const g = gameTime(this.life.t);
    const place = platformAt(this.world, w.pos.x, w.pos.z)?.label ?? "the wild meadow";
    return petScene(w.pos, this.seenThings().filter((s) => s.name !== `a wild ${w.arch}` || s.x !== w.pos.x), place, `${phaseOf(g.hour)} (${clockLabel(g.hour)})`);
  }

  private syncMinds(): void {
    const hub = this.minds;
    if (!hub) return;
    for (const id of [...hub.minds.keys()]) if (!this.residents.some((r) => r.agent.id === id)) hub.remove(id);
    for (const r of this.residents) {
      if (hub.minds.has(r.agent.id)) continue;
      const m = hub.add(petPersona(r.agent.id, r.genes), this.savedMinds?.minds[r.agent.id]?.mem);
      r.agent.plan = m.mem.plan;
    }
  }

  // The name on a bubble; empty for the player, who knows who they are.
  private speaker(who: string): string {
    if (who === "pet") return this.petName;
    if (who === "elder" || who === "n:elder") return "Elder";
    if (who.startsWith("n:")) return this.npcs?.v.agents.find((a) => a.id === who.slice(2))?.name ?? "";
    if (who.startsWith("p:")) return this.peers.get(who.slice(2))?.name ?? "";
    if (who.startsWith("w")) {
      const w = this.wilds.find((x) => `w${x.id}` === who);
      return w ? `Wild ${w.arch}` : "";
    }
    if (/^r\d/.test(who)) return this.residents[Number(who.slice(1))]?.agent.name ?? "";
    return "";
  }

  private sayAgent(id: string, text: string, to?: string): void {
    const i = this.residents.findIndex((r) => r.agent.id === id);
    if (i >= 0) this.say(`r${i}`, text, text === "..." ? 25 : 5, to); // "..." stays up until the line arrives
    if (i >= 0 && text !== "...") this.onMind?.({ who: id, say: text });
  }

  // Where a mind that speaks stands: an NPC, or me for my pets (they stay around me or my ground).
  speakerAt(who: string): { x: number; z: number } {
    const a = this.npcs?.v.agents.find((x) => x.id === who);
    return { x: a?.pos.x ?? this.player.x, z: a?.pos.z ?? this.player.z };
  }

  // Another player's mind line (a pet's spoken line or invitation) shows over that player; NPC lines over the NPC.
  hearMind(from: string, l: MindLine): void {
    if (isNpc(l.who)) return void this.npcs?.hear(l);
    const p = this.peers.get(from);
    if (!p) return;
    const text = l.say ?? (l.invite ? `come, ${ACTIVITY.get(l.invite.act)?.label ?? l.invite.act}!` : null);
    if (text) this.say(`p:${from}`, `${l.who}: ${text}`, 5); // their pets live on their ground: lines show over the owner
    // An invitation can reach my pets too: one of them adds it to its plan and says so.
    const took = l.invite ? this.minds?.heardInvite(l.who, l.invite.act) : null;
    const i = took ? this.residents.findIndex((r) => r.agent.id === took) : -1;
    if (i >= 0) this.say(`r${i}`, `ooh, ${l.invite!.act} with ${l.who}!`, 4);
  }

  // I: open the inspector on the nearest mind (or close it).
  toggleInspect(): boolean {
    if (this.inspect) {
      this.inspect = null;
      return false;
    }
    let best: string | null = null;
    let bd = 3.5;
    const hosted = this.npcs?.v.agents.filter((a) => this.npcs!.hub.minds.has(a.id)) ?? []; // NPC minds running here
    for (const a of [...this.residents.map((r) => r.agent), ...hosted]) {
      const d = Math.hypot(a.pos.x - this.player.x, a.pos.z - this.player.z);
      if (d < bd) [best, bd] = [a.id, d];
    }
    this.inspect = best;
    return !!best;
  }

  mindNear(): boolean {
    const hosted = this.npcs?.v.agents.filter((a) => this.npcs!.hub.minds.has(a.id)) ?? [];
    return [...this.residents.map((r) => r.agent), ...hosted].some((a) => Math.hypot(a.pos.x - this.player.x, a.pos.z - this.player.z) < 3.5);
  }

  // The poop you are standing next to, if any (E: clean it up).
  messNear(): number | null {
    let best: number | null = null;
    let bd = 1.4;
    for (const m of this.life.messes) {
      const d = Math.hypot(m.pos.x - this.player.x, m.pos.z - this.player.z);
      if (d < bd) [best, bd] = [m.id, d];
    }
    return best;
  }

  cleanMess(id: number): boolean {
    return cleanMess(this.life, id);
  }

  spawnWild(cx: number, cz: number, r: number): void {
    const seed = Math.floor(Math.random() * 1e9);
    const arch = ARCHETYPES[seed % ARCHETYPES.length]!;
    const genes = randomGenes(seed);
    for (let tries = 0; tries < 30; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * (r - 3);
      const pos = { x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d };
      if (!this.canWalk(pos.x, pos.z)) continue;
      this.wilds.push({ id: this.nextId++, arch, genes, sprite: drawMonster(petLook(genes), OVERWORLD_MON, "front", BUILDS[arch]), pos, home: { ...pos }, target: { ...pos }, wait: Math.random() * 2, cool: 0 });
      return;
    }
  }

  removeWild(id: number): void {
    const i = this.wilds.findIndex((w) => w.id === id);
    if (i >= 0) this.wilds.splice(i, 1);
  }

  // `to` = the name of whoever is spoken to, shown on the bubble with the speaker's.
  say(who: string, text: string, secs = 3.5, to?: string): void {
    this.bubbles.set(who, { text, t: Math.max(secs, text.length / READ_CHARS), to, held: false, wait: 0 });
  }

  // A thought, not speech: never covers a line being said, and only this screen sees it.
  think(who: string, text: string): void {
    const b = this.bubbles.get(who);
    if (!b || b.thought) this.bubbles.set(who, { text, t: 3.5, held: false, wait: 0, thought: true });
  }

  // A wild pet close enough to talk to (but not touching, which starts a fight).
  wildNear(): Wild | null {
    let best: Wild | null = null;
    let bd = 2.6;
    for (const w of this.wilds) {
      const d = Math.hypot(w.pos.x - this.player.x, w.pos.z - this.player.z);
      if (d < bd) [best, bd] = [w, d];
    }
    return best;
  }

  // The villager you are standing next to (E: talk), if any.
  npcNear(): Npc | null {
    let best: Npc | null = null;
    let bd = 2.2;
    for (const a of this.npcs?.v.agents ?? []) {
      const d = Math.hypot(a.pos.x - this.player.x, a.pos.z - this.player.z);
      if (d < bd) [best, bd] = [a.id as Npc, d];
    }
    if (!this.npcs && this.elder && Math.hypot(this.elder.pos.x - this.player.x, this.elder.pos.z - this.player.z) < 2.2) best = "elder";
    return best;
  }

  nearBoard(): boolean {
    const b = this.noticeBoard;
    return !!b && Math.abs(this.player.x - b.x) < 2 && this.player.z > b.z - 1 && this.player.z < b.z + 2.2;
  }

  nearStall(): boolean {
    const st = this.stall; // anywhere along its 3-tile front
    return !!st && Math.abs(this.player.x - st.x) < 2.2 && this.player.z > st.z - 0.5 && this.player.z < st.z + 2.6;
  }

  nearHome(): boolean {
    return Math.hypot(this.player.x - this.house.x, this.player.z - this.house.z) < 9;
  }

  residentSprites(): HTMLCanvasElement[] {
    return this.residents.map((r) => r.sprite);
  }

  exitHouse(): void {
    this.player = { x: this.house.x, z: this.house.z + 0.9 };
    this.pet = { x: this.house.x + 0.8, z: this.house.z + 1.4 };
    this.cam = { ...this.player };
    this.playerMotion.dir = 0;
    this.playerMotion.flip = false;
    this.playerMotion.pos = { ...this.player };
  }

  // The bed the player is standing next to and facing (or on), if any.
  bedNear(): number {
    const f = [[0, 0.7], [-0.7, 0], [0.7, 0], [0, -0.7]][this.playerMotion.dir]!;
    const x = this.player.x + f[0]!;
    const z = this.player.z + f[1]!;
    return this.beds.findIndex((b) => x >= b.x && x < b.x + 1 && z >= b.z && z < b.z + 1);
  }

  atDoor(): boolean {
    return Math.abs(this.player.x - this.house.x) < 0.8 && this.player.z > this.house.z && this.player.z < this.house.z + 1.2 && this.playerMotion.dir === 3;
  }

  private footprint(art: string): [number, number] {
    const [w, h] = stampSize(art);
    return [w / 32, h / 32 + 0.6]; // half width, depth in tiles (the roof leans back over open ground)
  }

  private drawBeds(g: CanvasRenderingContext2D, toScreen: (x: number, z: number) => [number, number], t: number): void {
    this.beds.forEach((b, i) => {
      const [sx, sy] = toScreen(b.x, b.z);
      const p = this.farm?.plots[i];
      stand(g, "soil", sx + 8, sy + 14);
      if (p?.crop) drawCropArt(g, CROP_ART[p.crop] ?? "carrot", CROP_STAGE[Math.min(3, p.stage)]!, sx + 8, sy + 13);
      if (p && p.wetUntil) {
        g.fillStyle = PAL.teal; // wet soil: teal corner marker (STYLE.md farms)
        g.fillRect(sx + 3, sy + 11, 2, 2);
        g.fillRect(sx + 11, sy + 11, 2, 2);
      } else if (p && needsWater(p) && Math.floor(t * 2) % 2) {
        g.fillStyle = PAL.waterL;
        g.fillRect(sx + 7, sy - 4, 2, 3);
        g.fillRect(sx + 6, sy - 2, 4, 2);
      }
    });
  }

  underBubbles?: () => void; // the screen's own panels: speech draws over them

  readonly canWalk = (x: number, z: number): boolean => {
    if (!tileWalkable(this.map, x, z) || railBlocks(this.map, x, z)) return false;
    const [hw, hd] = this.footprint(HOME_ART);
    if (Math.abs(x - this.house.x) < hw && z < this.house.z + 0.2 && z > this.house.z - hd) return false;
    for (const h of this.houses) {
      const [w, d] = this.footprint(h.art);
      if (Math.abs(x - h.x) < w && z < h.z + 0.2 && z > h.z - d) return false;
    }
    for (const l of this.landmarks) {
      const [w, d] = this.footprint(l.art);
      if (Math.abs(x - l.x) < w && z < l.z + 0.2 && z > l.z - d) return false;
    }
    if (this.stall && Math.abs(x - this.stall.x) < 1.4 && z < this.stall.z + 0.2 && z > this.stall.z - 1.4) return false;
    // A tile-deep support footprint also blocks tile-centre routes; the panel can overhang it.
    if (this.noticeBoard && Math.abs(x - this.noticeBoard.x) < 0.8 && z > this.noticeBoard.z - 0.8 && z < this.noticeBoard.z + 0.2) return false;
    if (this.beds.some((b) => x >= b.x - 0.1 && x < b.x + 1.1 && z >= b.z - 0.1 && z < b.z + 1.1)) return false;
    const i = Math.floor(x - this.map.ox);
    const j = Math.floor(z - this.map.oz);
    return !this.treeTiles.has(j * this.map.w + i) && !this.decorTiles.has(j * this.map.w + i);
  };

  // Returns the wild monster the player just bumped into, if any.
  // The online player standing next to you, if any (E: duel / emote / say).
  peerNear(): string | null {
    let best: string | null = null;
    let bd = 2.2;
    for (const [id, p] of this.peers) {
      const d = Math.hypot(p.pos.x - this.player.x, p.pos.z - this.player.z);
      if (d < bd) [best, bd] = [id, d];
    }
    return best;
  }

  addPeer(id: string, name: string, genes: Genes, x: number, z: number, px: number, pz: number): void {
    this.peers.set(id, { name, look: humanLook(liveName(genes)), pos: { x, z }, motion: newHumanMotion({ x, z }), pet: { x: px, z: pz }, to: { x, z, px, pz }, sprite: drawMonster(petLook(genes), OVERWORLD_MON, "front") });
  }

  movePeer(id: string, x: number, z: number, px: number, pz: number): void {
    const p = this.peers.get(id);
    if (p) p.to = { x, z, px, pz };
  }

  get me(): { x: number; z: number; px: number; pz: number } {
    return { x: this.player.x, z: this.player.z, px: this.pet.x, pz: this.pet.z };
  }

  update(dt: number, keys: ReadonlySet<string>): Wild | "boss" | "ghost" | null {
    const d = keyDir(keys);
    this.moving = d.x !== 0 || d.z !== 0;
    if (this.moving) {
      const speed = (keys.has("shift") ? HUMAN_RUN_SPEED : HUMAN_WALK_SPEED) * dt;
      this.player = slide(this.player, d.x * speed, d.z * speed, this.canWalk);
    }
    stepHumanMotion(this.playerMotion, this.player, dt);
    this.moving = this.playerMotion.walking;
    this.pet = followStep(this.pet, this.player, dt, this.canWalk);
    // Camera eases toward the player; drawing snaps it to whole pixels.
    const k = 1 - Math.exp(-dt * 8);
    this.cam = { x: this.cam.x + (this.player.x - this.cam.x) * k, z: this.cam.z + (this.player.z - this.cam.z) * k };
    const here = platformAt(this.world, this.player.x, this.player.z)?.label ?? "";
    if (here && here !== this.place) this.bannerT = 2.5;
    this.place = here || this.place;
    this.bannerT = Math.max(0, this.bannerT - dt);
    // A bubble waiting for room keeps its time, so its line is still read, unless the wait grows stale.
    for (const [k, b] of this.bubbles) if ((b.held ? (b.wait += dt) > 12 : (b.t -= dt) <= 0)) this.bubbles.delete(k);
    this.life.t = worldSeconds() - dt; // the shared clock (stepVillage adds dt back)
    const lifeEv = stepVillage(this.life, dt, this.lifeEnv);
    if (this.npcs) {
      for (const a of this.npcs.v.agents) if (!this.npcMotions.has(a.id as Npc)) this.npcMotions.set(a.id as Npc, newHumanMotion(a.pos));
      for (const e of this.npcs.step(dt, this.life.t)) if (e.kind === "start" && e.act !== "wander") this.say(`n:${e.who}`, ACTIVITY.get(e.act)!.label, 2.5);
      for (const a of this.npcs.v.agents) stepHumanMotion(this.npcMotions.get(a.id as Npc)!, a.pos, dt, a.state === "do" ? ACTIVITY.get(a.act!)?.pose ?? null : null);
      for (const a of this.npcs.v.agents) {
        const id = a.id as Npc;
        if (!this.npcs.hasPet[id]) continue;
        const pet = this.npcPets.get(id);
        const pos = pet && this.canWalk(pet.x, pet.z) ? pet : slide(a.pos, -0.8, 0.8, this.canWalk);
        const next = followStep(pos, a.pos, dt, this.canWalk);
        if (this.canWalk(next.x, next.z)) this.npcPets.set(id, next);
      }
      const ea = this.npcs.v.agents.find((a) => a.id === "elder");
      if (ea && this.elder) this.elder.pos = ea.pos;
    }
    this.minds?.onEvents(lifeEv);
    this.minds?.tick();
    for (const e of lifeEv) {
      const i = this.residents.findIndex((r) => r.agent.id === e.who);
      if (i < 0) continue;
      if (e.kind === "start" && e.act !== "wander") this.say(`r${i}`, ACTIVITY.get(e.act)!.label, 2.5);
      if (e.kind === "start") this.onMind?.({ who: e.who, act: e.act });
      if (e.kind === "cancel") this.say(`r${i}`, "...nobody came", 2.5);
    }
    let met: Wild | null = null;
    for (const w of this.wilds) {
      w.cool = Math.max(0, w.cool - dt);
      w.wait -= dt;
      if (w.wait <= 0) {
        const s = stepToward(w.pos, w.target, WALK_SPEED * 0.35 * dt);
        w.pos = slide(w.pos, s.dx, s.dz, this.canWalk);
        if (s.arrived) {
          w.wait = 1 + Math.random() * 3;
          w.target = { x: w.home.x + (Math.random() - 0.5) * 8, z: w.home.z + (Math.random() - 0.5) * 8 };
        }
      }
      if (!met && !w.cool && Math.hypot(w.pos.x - this.player.x, w.pos.z - this.player.z) < MEET_DIST) met = w;
    }
    const k8 = 1 - Math.exp(-dt * 8);
    for (const p of this.peers.values()) {
      const step = stepToward(p.pos, p.to, HUMAN_RUN_SPEED * dt);
      p.pos.x += step.dx;
      p.pos.z += step.dz;
      stepHumanMotion(p.motion, p.pos, dt);
      p.pet.x += (p.to.px - p.pet.x) * k8;
      p.pet.z += (p.to.pz - p.pet.z) * k8;
    }
    const gs = this.ghostStone;
    if (gs) {
      gs.cool = Math.max(0, gs.cool - dt);
      if (!met && !gs.cool && Math.hypot(gs.pos.x - this.player.x, gs.pos.z - this.player.z) < MEET_DIST + 0.3) return "ghost";
    }
    const b = this.boss;
    if (b) {
      b.cool = Math.max(0, b.cool - dt);
      if (!met && !b.cool && Math.hypot(b.pos.x - this.player.x, b.pos.z - this.player.z) < MEET_DIST + 0.4) return "boss";
    }
    return met;
  }

  draw(g: CanvasRenderingContext2D, sw: number, sh: number, t: number): void {
    const m = this.map;
    const camX = Math.round(this.cam.x * TILE - sw / 2);
    const camY = Math.round(this.cam.z * TILE - sh / 2);
    const toScreen = (x: number, z: number): [number, number] => [Math.round(x * TILE) - camX, Math.round(z * TILE) - camY];
    drawSea(g, m, camX, camY, sw, sh, t);
    drawLowClouds(g, m, camX, camY, sw, sh, t);
    drawLand(g, m, this.sunny, camX, camY, sw, sh, t);
    this.drawBeds(g, toScreen, t);
    const plaza = this.world.platforms.find((p) => p.kind === "plaza");
    if (plaza) {
      const dancing = this.npcs?.v.agents.some((a) => a.act === "dance") ?? false;
      if (dancing) for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) {
        const [sx, sy] = toScreen(plaza.x - 3 + i, plaza.z - 2 + j);
        generatedSprites.draw(g, "dance-floor-active", sx, sy);
      }
    }
    // Sprites sorted by their feet, so things lower on screen stand in front.
    const items: { z: number; draw: () => void }[] = [];
    if (this.noticeBoard) {
      const board = this.noticeBoard;
      const [sx, sy] = toScreen(board.x, board.z);
      items.push({ z: board.z, draw: () => generatedSprites.draw(g, "notice-board-notes", sx, sy, () => {
        g.fillStyle = PAL.woodD;
        g.fillRect(sx - 10, sy - 18, 2, 18);
        g.fillRect(sx + 8, sy - 18, 2, 18);
        g.fillStyle = PAL.wood;
        g.fillRect(sx - 13, sy - 29, 26, 23);
        g.fillStyle = PAL.cream;
        g.fillRect(sx - 9, sy - 25, 7, 10);
        g.fillRect(sx + 2, sy - 23, 7, 11);
      }) });
    }
    const today = gameTime(this.life.t).day;
    // Due promises remain open. The room shares promise memory only with that NPC's host.
    const birthday = NPCS.some((id) => (this.npcs?.hub.minds.get(id)?.mem.promises ?? [])
      .some((p) => p.state === "open" && p.day === today && /birthday/i.test(p.occasion)));
    if (plaza && birthday) {
      // Decorations sit just outside the dance floor; they do not obstruct the plaza routes.
      const [bx, by] = toScreen(plaza.x, plaza.z - 2.5);
      items.push({ z: plaza.z - 2.5, draw: () => generatedSprites.draw(g, "birthday-bunting", bx, by - 18) });
      const balloons = ["birthday-balloon-red", "birthday-balloon-blue", "birthday-balloon-gold"] as const;
      balloons.forEach((name, i) => {
        const z = plaza.z + (i === 2 ? 1.5 : -1.5);
        const [sx, sy] = toScreen(plaza.x + (i === 0 ? -3.5 : 3.5), z);
        items.push({ z, draw: () => generatedSprites.draw(g, name, sx, sy) });
      });
    }
    for (const tr of this.trees) {
      const [sx, sy] = toScreen(tr.x, tr.z);
      if (sx < -32 || sy < -48 || sx > sw + 32 || sy > sh + 48) continue;
      const seed = Math.floor(hash2(Math.floor(tr.x), Math.floor(tr.z), 12) * 1000);
      items.push({ z: tr.z, draw: () => drawTree(g, seed, sx, sy + 4, t, 0) });
    }
    const lit = gameTime(this.life.t).phase;
    for (const d of this.decor) {
      const [sx, sy] = toScreen(d.x, d.z);
      if (sx < -40 || sy < -40 || sx > sw + 40 || sy > sh + 40) continue;
      const look = lookAt(m, Math.floor(d.x), Math.floor(d.z));
      items.push({ z: d.z - (d.kind === "lights" ? 0.2 : 0), draw: () => drawDecor(g, d.kind, sx, sy + 8, Math.max(1, d.tiles.length), look, lit === "evening" || lit === "night") });
    }
    {
      const [hx, hy] = toScreen(this.house.x, this.house.z);
      items.push({ z: this.house.z, draw: () => this.drawHouse(g, HOME_ART, hx, hy, t) });
    }
    for (const h of this.houses) {
      const [hx, hy] = toScreen(h.x, h.z);
      if (hx < -64 || hy < -16 || hx > sw + 64 || hy > sh + 110) continue;
      items.push({ z: h.z, draw: () => this.drawHouse(g, h.art, hx, hy, t) });
    }
    for (const l of this.landmarks) {
      const [lx, ly] = toScreen(l.x, l.z);
      if (lx < -60 || ly < -16 || lx > sw + 60 || ly > sh + 100) continue;
      items.push({ z: l.z, draw: () => stand(g, l.art, lx, ly) });
    }
    for (const c of this.critters) {
      const [cx, cy] = toScreen(c.x, c.z);
      if (cx < -40 || cy < -40 || cx > sw + 40 || cy > sh + 40) continue;
      items.push({ z: c.z, draw: () => strip(g, c.art, cx - 16, cy - 24, Math.floor(t * 3 + c.seed), c.seed % 2 === 1) });
    }
    for (const p of this.world.platforms) {
      if (!p.spots) continue;
      for (const [name, at] of Object.entries(p.spots)) {
        const [sx, sy] = toScreen(at.x, at.z);
        if (sx < -48 || sy < -48 || sx > sw + 48 || sy > sh + 48) continue;
        items.push({ z: at.z - (name === "blanket" || name === "dock" ? 9 : 0), draw: () => drawSpotProp(g, name, sx, sy, t) });
      }
    }
    const [px, py] = toScreen(this.player.x, this.player.z);
    const pf = spriteFrame(this.playerSprite, this.moving, this.playerMotion.walkTime, t);
    items.push({ z: this.player.z, draw: () => (characterShadow(g, px, py), humanSprites.draw(g, this.myLook, this.playerMotion, px, py, t,
      () => g.drawImage(this.playerSprite.img, pf * 16, this.playerMotion.dir * 24, 16, 24, px - 8, py - 22, 16, 24))) });
    const half = OVERWORLD_MON / 2;
    for (const p of this.peers.values()) {
      const [ax, ay] = toScreen(p.pos.x, p.pos.z);
      const [bx, by] = toScreen(p.pet.x, p.pet.z);
      items.push({ z: p.pos.z, draw: () => {
        characterShadow(g, ax, ay);
        humanSprites.draw(g, p.look, p.motion, ax, ay, t,
          () => g.drawImage(this.playerSprite.img, spriteFrame(this.playerSprite, p.motion.walking, p.motion.walkTime, t) * 16, p.motion.dir * 24, 16, 24, ax - 8, ay - 22, 16, 24));
      } });
      items.push({ z: p.pet.z, draw: () => g.drawImage(p.sprite, bx - half, by - OVERWORLD_MON + 2) });
    }
    if (this.stall) {
      const [mx, my] = toScreen(this.stall.x, this.stall.z);
      items.push({ z: this.stall.z, draw: () => stand(g, "stall-red", mx, my + 4) });
    }
    if (this.elder && !this.npcs?.v.agents.some(a => a.id === "elder")) {
      // The Elder also uses the shared human path before the NPC sim is attached.
      const [nx, ny] = toScreen(this.elder.pos.x, this.elder.pos.z);
      items.push({ z: this.elder.pos.z, draw: () => humanSprites.draw(g, NPC_LOOKS.elder, newHumanMotion(this.elder!.pos), nx, ny, t, () => {
        if (hasArt("elder-npc")) g.drawImage(img("elder-npc"), (Math.floor(t * 2) % 2) * 16, 0, 16, 24, nx - 8, ny - 22, 16, 24);
        else g.drawImage(this.elder!.sprite, nx - 12, ny - 22);
      }) });
    }
    for (const npc of [this.boss, this.ghostStone]) {
      if (!npc) continue;
      const [nx, ny] = toScreen(npc.pos.x, npc.pos.z);
      const s = npc.sprite;
      items.push({ z: npc.pos.z, draw: () => g.drawImage(s, nx - s.width / 2, ny - s.height + 2 - (Math.floor(t * 1.5) % 2)) });
    }
    const [qx, qy] = toScreen(this.pet.x, this.pet.z);
    const hop = Math.floor(t * 4) % 2;
    items.push({ z: this.pet.z, draw: () => g.drawImage(this.petSprite, qx - half, qy - OVERWORLD_MON + 2 - hop) });
    for (const [id, pos] of this.npcPets) {
      if (!this.npcs?.hasPet[id]) continue;
      const [nx, ny] = toScreen(pos.x, pos.z);
      if (nx < -24 || ny < -24 || nx > sw + 24 || ny > sh + 24) continue;
      items.push({ z: pos.z, draw: () => {
        const image = this.npcPetImages.get("/art/gen/wild/forest-sprig-16-front-idle.png");
        if (image) g.drawImage(image, nx - 8, ny - 14 - hop);
      } });
    }
    for (const w of this.wilds) {
      const [wx, wy] = toScreen(w.pos.x, w.pos.z);
      if (wx < -24 || wy < -24 || wx > sw + 24 || wy > sh + 24) continue;
      const wh = w.wait <= 0 ? Math.floor(t * 5 + w.id) % 2 : 0;
      items.push({ z: w.pos.z, draw: () => g.drawImage(w.sprite, wx - half, wy - OVERWORLD_MON + 2 - wh) });
    }
    {
      const [bx, by] = toScreen(this.bowl.x, this.bowl.z);
      items.push({ z: this.bowl.z, draw: () => drawBowl(g, bx, by) });
    }
    for (const m of this.life.messes) {
      const [mx, my] = toScreen(m.pos.x, m.pos.z);
      items.push({ z: m.pos.z - 0.3, draw: () => drawPoop(g, mx, my, t, m.id) });
    }
    this.residents.forEach((r, k) => {
      const a = r.agent;
      const [rx, ry] = toScreen(a.pos.x, a.pos.z);
      if (rx < -24 || ry < -40 || rx > sw + 24 || ry > sh + 24) return;
      const pose = a.state === "do" ? ACTIVITY.get(a.act!)!.pose : null;
      items.push({ z: a.pos.z, draw: () => drawPetPose(g, r.sprite, rx, ry, pose, a.state === "walk", t, k) });
    });
    // Every villager, including the Elder, follows the same human drawing path as online players.
    for (const a of this.npcs?.v.agents ?? []) {
      const [nx, ny] = toScreen(a.pos.x, a.pos.z);
      if (nx < -24 || ny < -40 || nx > sw + 24 || ny > sh + 24) continue;
      const s = this.npcSprite(a.id as Npc);
      const motion = this.npcMotions.get(a.id as Npc) ?? newHumanMotion(a.pos);
      const { walking, dir } = motion;
      const sit = a.state === "do" && (ACTIVITY.get(a.act!)!.pose === "sit" || ACTIVITY.get(a.act!)!.pose === "sleep");
      const f = spriteFrame(s, walking, motion.walkTime, t);
      const frame = sit ? sitFrame(s.img, (s.idle ?? 0) * 16, dir * 24, dir === 3) : null; // seated: still, legs bent
      items.push({ z: a.pos.z, draw: () => (characterShadow(g, nx, ny), humanSprites.draw(g, NPC_LOOKS[a.id as Npc], motion, nx, ny, t, () => {
        if (a.id === "elder" && hasArt("elder-npc")) g.drawImage(img("elder-npc"), (Math.floor(t * 2) % 2) * 16, 0, 16, 24, nx - 8, ny - 22, 16, 24);
        else if (frame) g.drawImage(frame, nx - 8, ny - 22);
        else g.drawImage(s.img, f * 16, dir * 24, 16, 24, nx - 8, ny - 22, 16, 24);
      })) });
    }
    for (const sg of this.signs) {
      const [sx, sy] = toScreen(sg.x, sg.z);
      if (sx < -48 || sy < -48 || sx > sw + 48 || sy > sh + 48) continue;
      const near = Math.hypot(sg.x - this.player.x, sg.z - this.player.z) < 7;
      items.push({ z: sg.z, draw: () => {
        drawSpotProp(g, "sign", sx, sy + 4, t);
        if (near) drawTinyText(g, sg.text, Math.round(sx), sy - 16);
      } });
    }
    // A picnic away from a picnic hill (the NPCs on the plaza) spreads its own blanket.
    for (const gt of [...this.life.gatherings, ...(this.npcs?.v.gatherings ?? [])]) {
      if (gt.act !== "picnic" || !gt.started) continue;
      if (this.world.platforms.some((p) => p.spots?.blanket && Math.hypot(p.spots.blanket.x - gt.at.x, p.spots.blanket.z - gt.at.z) < 4)) continue;
      const ps = [...this.life.agents, ...(this.npcs?.v.agents ?? [])].filter((a) => gt.members.includes(a.id) && a.gather === gt.id);
      if (!ps.length) continue;
      const cx = ps.reduce((sum, a) => sum + a.pos.x, 0) / ps.length; // under the group, wherever they sat down
      const cz = ps.reduce((sum, a) => sum + a.pos.z, 0) / ps.length;
      const [bx, by] = toScreen(cx, cz + 0.7);
      items.push({ z: cz - 9, draw: () => drawSpotProp(g, "blanket", bx, by, t) });
    }
    // A ball bounces between pets playing together.
    for (const gt of this.life.gatherings) {
      if (gt.act !== "ball" || !gt.started) continue;
      const ps = gt.members.map((id) => this.life.agents.find((a) => a.id === id)).filter((a): a is Agent => !!a && a.state === "do");
      if (ps.length < 2) continue;
      const ph = (t * 0.8 + gt.id) % 2;
      const u = ph < 1 ? ph : 2 - ph;
      const [a, b] = [ps[0]!.pos, ps[1]!.pos];
      const [x, y] = toScreen(a.x + (b.x - a.x) * u, a.z + (b.z - a.z) * u);
      items.push({ z: a.z + (b.z - a.z) * u, draw: () => drawBall(g, x, y - Math.round(Math.sin(u * Math.PI) * 8)) });
    }
    items.sort((a, b) => a.z - b.z);
    for (const it of items) it.draw();
    drawHighClouds(g, camX, camY, sw, sh, t);
    const now = gameTime(this.life.t);
    if (!this.alwaysDay) drawTint(g, now.hour, sw, sh);
    {
      const label = `${weekday(now.day)} ${clockLabel(now.hour)}`;
      drawText(g, label, sw - label.length * GLYPH - 6, 6, PAL.panel);
    }
    if (this.ui.map) this.drawMinimap(g, sw);
    if (this.ui.names) this.drawNames(g, toScreen, sw, sh);

    this.underBubbles?.();
    const shown: { b: Bubble; head: string; lines: string[]; cx: number; y: number; box: BubbleBox }[] = [];
    for (const [who, b] of this.bubbles) {
      const pos = who === "pet" ? this.pet : who === "me" ? this.player : who.startsWith("p:") ? this.peers.get(who.slice(2))?.pos : who === "elder" || who === "n:elder" ? this.elder?.pos : who.startsWith("n:") ? this.npcs?.v.agents.find((a) => a.id === who.slice(2))?.pos : who === "boss" ? this.boss?.pos : who.startsWith("r") ? this.residents[Number(who.slice(1))]?.agent.pos : this.wilds.find((w) => `w${w.id}` === who)?.pos;
      if (!pos) continue;
      const [bx, by] = toScreen(pos.x, pos.z);
      if (bx < -10 || by < -10 || bx > sw + 10 || by > sh + 40) continue; // someone out of sight stays out of sight
      const head = this.speaker(who);
      const label = b.thought ? `${head} thinks` : head && b.to ? `${head} > ${b.to}` : head;
      const lines = wrap(b.text, Math.min(180, sw - 24));
      const w = Math.max(label.length, ...lines.map((l) => l.length)) * GLYPH + 12;
      const bottom = by - OVERWORLD_MON - 12;
      shown.push({ b, head: label, lines, cx: bx, y: bottom, box: { cx: bx, bottom, w, h: (lines.length + (label ? 1 : 0)) * 10 + 8, first: who === "me" || b.to === this.myName } });
    }
    const spots = layoutBubbles(shown.map((s) => s.box), sw, sh);
    shown.forEach((s, i) => {
      const spot = spots[i];
      s.b.held = !spot;
      if (spot) bubble(g, s.head, s.lines, s.cx, s.box.w, s.box.h, spot, s.b.thought);
      else stand(g, "expression_chat", s.cx, s.y + 12); // their line waits its turn
    });
    const bed = this.bedNear();
    const hint = this.atDoor()
      ? "E: GO IN"
      : bed >= 0 && this.farm
        ? bedHint(this.farm, bed)
        : this.nearStall() ? "E: MARKET" : this.nearBoard() ? "E: BOARD" : this.npcNear() ? "E: TALK" : this.messNear() !== null ? "E: CLEAN" : this.peerNear() ? "E: SAY HI" : this.mindNear() && !this.inspect ? "I: MIND" : "";
    if (hint) {
      const w = hint.length * GLYPH + 12;
      drawFrame(g, Math.round(px - w / 2), py + 6, w, 16);
      drawText(g, hint, Math.round(px - w / 2) + 6, py + 10, PAL.wood);
    }
    const npc = !!this.inspect && !!this.npcs?.hub.minds.has(this.inspect);
    const [hub, v] = npc ? [this.npcs!.hub, this.npcs!.v] : [this.minds, this.life];
    const im = this.inspect ? hub?.minds.get(this.inspect) : undefined;
    const ia = this.inspect ? v.agents.find((a) => a.id === this.inspect) : undefined;
    if (im && ia) drawInspector(g, im, ia, v.rel, (id) => hub?.minds.get(id)?.persona.name ?? id, npc ? `${this.mindWhere}, for all` : this.mindWhere, sw, sh);
    else this.inspect = null;
    if (this.bannerT > 0 && this.place) {
      const w = this.place.length * GLYPH + 16;
      const x = Math.floor((sw - w) / 2);
      const y = this.bannerT > 2.2 ? -16 + Math.round((2.5 - this.bannerT) * 70) : this.bannerT < 0.3 ? 5 - Math.round((0.3 - this.bannerT) * 70) : 5;
      drawFrame(g, x, y, w, 17);
      drawText(g, this.place, x + 8, y + 5, PAL.wood);
    }
  }
}

function bedHint(f: Farm, i: number): string {
  const p = f.plots[i]!;
  if (!p.crop) return Object.values(f.seeds).some((n) => n) ? "E: PLANT" : "NO SEEDS";
  if (p.stage >= 3) return "E: HARVEST";
  return needsWater(p) ? "E: WATER" : "GROWING...";
}

interface Bubble {
  text: string;
  t: number; // seconds left on screen
  to?: string;
  thought?: boolean; // drawn with a trail of dots instead of a tail
  held: boolean; // no free spot right now
  wait: number; // seconds spent held
}

// A speech bubble above a sprite: up to 3 wrapped lines, kept on screen, with a small tail.
function bubble(g: CanvasRenderingContext2D, head: string, lines: readonly string[], cx: number, w: number, h: number, at: Placed, thought = false): void {
  const { x, y } = at;
  drawFrame(g, x, y, w, h);
  if (thought) {
    if (!at.moved) {
      g.fillStyle = PAL.ink;
      g.fillRect(cx - 1, y + h + 1, 3, 2);
      g.fillRect(cx, y + h + 4, 1, 1);
    }
  } else if (!at.moved) {
    g.fillStyle = PAL.panel;
    g.fillRect(cx - 2, y + h - 1, 4, 2);
    g.fillStyle = PAL.wood;
    g.fillRect(cx - 1, y + h + 1, 2, 2);
  }
  if (head) drawText(g, head, x + 6, y + 5, PAL.teal);
  const top = y + 5 + (head ? 10 : 0);
  lines.forEach((l, i) => drawText(g, l, x + 6, top + i * 10));
}

interface Peer {
  name: string;
  pos: Vec;
  motion: HumanMotion;
  pet: Vec;
  to: { x: number; z: number; px: number; pz: number };
  sprite: HTMLCanvasElement;
  look: HumanLook;
}

// The ghost stone: a pale standing stone with a teal wisp (palette only).
function ghostSprite(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 20;
  c.height = 28;
  const g = c.getContext("2d")!;
  const r = (x: number, y: number, w: number, h: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  };
  r(3, 10, 14, 18, PAL.ink);
  r(4, 11, 12, 16, PAL.stone);
  r(4, 11, 4, 16, PAL.stoneL);
  r(5, 9, 10, 2, PAL.ink);
  r(6, 8, 8, 1, PAL.ink);
  r(8, 16, 4, 4, PAL.teal);
  r(9, 17, 2, 2, PAL.waterL);
  r(7, 1, 6, 5, PAL.waterL);
  r(8, 0, 4, 1, PAL.foam);
  r(9, 6, 2, 2, PAL.foam);
  return c;
}
