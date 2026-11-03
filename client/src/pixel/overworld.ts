// The top-down overworld scene: tile map, trees, the player and the following pet, a pixel-snapped follow
// camera and the place banner. Game rules (movement, the map) come from ../world; this file only decides
// what is where on screen.

import { groundOrigin, onGround, platformAt, worldDay, type LayoutInput, type Platform, type WorldMap } from "../world/layout";
import { GLAD_TIME, HATCH_TIME, petMood } from "../game/pet-mood";
import { followStep, keyDir, slide, stepToward, unstick, WALK_SPEED, type Vec } from "../world/movement";
import { petLook, randomGenes } from "../game/genes";
import type { Genes } from "../sim/ghost";
import { ARCHETYPES, type ArchetypeId } from "../sim/types";
import { hasArt, img, makePlayer, PAL, type ArtName, type Sprite } from "./art";
import { placeDecor, type DecorPiece } from "./grounds-decor";
import { needsWater, PLOTS, type Farm } from "../game/farm";
import { cloudLine } from "../game/npc-chat";
import { CLOUD_CHAT } from "../game/test-mode";
import { BUILDS, drawMonster } from "./monster";
import { buildTileMap, hash2, T, TILE, tileAt, tileWalkable, type TileMap } from "../world/tilemap";
import { NPC_HOMES } from "../world/village-map";
import { buildSunny, stampSize, stand, type SunnyWorld } from "./sunny";
import { ACTIVITY, type Pose } from "../life/activities";
import type { Scene, SceneBed, SceneBubble, SceneInspector, ScenePanel, ScenePerson, ScenePet, SceneProp, View } from "../game/ports";
import { inspectorLines } from "./inspector";
import { PixelView } from "./pixel-view";
import { compass, type Place } from "../mind/directions";
import { clockLabel, gameTime, phaseOf, weekday, worldSeconds } from "../life/clock";
import { addAgent, cleanMess, newVillage, removeAgent, stepVillage, type Agent, type Env, type Spots } from "../life/village";
import { mulberry32 } from "../sim/rng";
import { findRoute } from "../world/route";
import { cornerBlocks, railBlocks, seaCell, tile } from "./sunny-terrain";
import { HOME_BLOCKS, HOME_DOOR_DX } from "../game/house";
import { liveName } from "../world/live";
import { villageWorld } from "../world/village-map";
import { MindHub, type MindsSave } from "../mind/hub";
import { petPersona } from "../mind/persona";
import type { MindScheduler } from "../mind/scheduler";
import { isNpc, type MindLine, type Npc } from "../world/live";
import { NpcVillage } from "../mind/npcs";
import { cleanScene, petScene, sharedScene, type Seen } from "../mind/scene";
import { SpriteImages } from "./generated-sprites";
import { HUMAN_RUN_SPEED, HUMAN_WALK_SPEED, humanLook, newHumanMotion, NPC_LOOKS, stepHumanMotion, type HumanLook, type HumanMotion } from "./humans";

const LANDMARK_PROP: Record<string, string> = { spr_deco_well: "well" };
const CLUMP = 6; // tiles: trees gather in cells of this size
const SHORE: readonly (readonly [number, number])[] = [[-2, 0], [2, 0], [-1, 0], [1, 0], [0, -2], [-2, 1], [2, 1], [0, 1], [0, 2], [0, 3], [-2, 3], [2, 3]];
// The mouth of each house's chimney, in pixels from the stamp's top left. Houses not listed have none.
export const CHIMNEY: Record<string, [number, number]> = { "house-blue": [63, 11], "house-red": [15, 1], "house-orange": [15, 22], "house-orangelong": [63, 18], "house-bluesmall": [55, 7] };
const READ_CHARS = 12; // a bubble stays long enough to read at this many characters a second
const xz = (v: Vec) => ({ x: v.x, z: v.z });
const DECOR_NAME: Record<DecorPiece["kind"], string> = { crates: "some crates", "crop-carrot": "a carrot patch", "crop-wheat": "a wheat patch", flowers: "some flowers", grass: "some tall grass", windmill: "a windmill", stump: "a tree stump", "fence-v": "a fence", jar: "a clay jar", bush: "a bush", "bush-big": "a big bush", rock: "a rock", "rock-big": "a big rock", fence: "a fence", lights: "party lights" };
const SPOT_NAME: Partial<Record<keyof Spots, string>> = { bed: "a bed", lawn: "the lawn", playground: "the playground slide and goal", picnic: "the picnic blanket", pond: "the fishing pond", plaza: "the village square" };

export const OVERWORLD_MON = 20; // px: monsters in the overworld
const WILD_PER_MEADOW = 3;
const MEET_DIST = 1.0;
const NPC_ROUTE_TILES = 120_000; // the NPCs may walk across the whole map
export const HOME_ART = "home-wing-roof";
const HOUSE_ART = ["house-red", "house-green", "house-redsmall", "house-bluesmall"];
export const CROP_ART: Record<string, string> = { wheat: "wheat", carrot: "carrot", tomato: "radish" };
// Farm stages 0-3 onto the pack's six growth pictures.
export const CROP_STAGE = [1, 2, 3, 4]; // the pack's stage 5 is the harvested item, not a plant

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
  landmarks: Landmark[] = [];
  critters: { art: string; x: number; z: number; seed: number }[] = [];
  sunny!: SunnyWorld;
  view: View = new PixelView(this); // what draws the frame
  panels: ScenePanel[] = []; // set by the game each frame
  chips: Scene["chips"] = undefined; // the small buttons, when the view draws them
  ui = { names: true, map: true }; // the small buttons (main.ts)
  alwaysDay = false; // dev hook: screenshots at any hour
  player: Vec = { x: 0, z: 0 };
  pet: Vec = { x: 0, z: 0 };
  moving = false;
  readonly playerMotion = newHumanMotion(this.player);
  readonly npcMotions = new Map<Npc, HumanMotion>();
  readonly npcPets = new Map<Npc, Vec>();
  readonly npcPetImages = new SpriteImages();
  private place = "";
  private bannerT = 0;
  private sprite: Sprite | null = null;
  get playerSprite(): Sprite {
    return (this.sprite ??= makePlayer()); // after loadArt: the ImageGen walk sheet
  }
  petSprite: HTMLCanvasElement;
  petGenes: Genes;
  readonly wilds: Wild[] = [];
  private nextId = 1;
  residents: Resident[] = [];
  readonly life = newVillage();
  private lifeEnv: Env;
  bowl: Vec = { x: 0, z: 0 };
  minds: MindHub | null = null;
  npcs: NpcVillage | null = null; // Elder, Mo, Ama, Pip on the hub (their minds run on whoever hosts them)
  private npcSprites = new Map<Npc, Sprite>();
  signs: { x: number; z: number; text: string }[] = []; // owner's name at each ground's hub-side gate
  mini: HTMLCanvasElement | null = null; // the whole map, 1 px per tile (rebuilt on relayout)
  private savedMinds: MindsSave | null = null;
  inspect: string | null = null; // the mind shown in the inspector (I)
  mindWhere = "this computer";
  myName = "a visitor"; // set by main.ts (the live name), so villagers can greet me by name
  myLook: HumanLook = humanLook("a visitor"); // from my pet's genes, so renaming keeps my hair
  hatchLeft = 0; // seconds until the egg opens, first visit only
  private petStill = 0; // seconds you have stood still
  private petGlad = 0; // seconds of cheering left, after a win
  private petHeld = 0; // seconds it has been pushing against something
  petName = "your pet"; // the pet following me (main.ts), so villagers can talk to it by name
  cam: Vec = { x: 0, z: 0 };
  house: Vec = { x: 0, z: 0 }; // the A-frame's front-centre (door) at the home plaza
  beds: Vec[] = []; // farm bed tile corners (world units), 3x2 east of the A-frame
  private allBeds: Vec[] = []; // the same on every ground: all machines must agree on what stands where
  readonly peerFarms = new Map<string, readonly [string, number][]>();
  farm: Farm | null = null; // set by main.ts; drawn on the beds
  // The Elder on her island stands still: press E by her to talk.
  elder: { pos: Vec; sprite: HTMLCanvasElement } | null = null;
  // The market stall on the market island: E there opens the same buy/sell menu as the crate at home.
  stall: Vec | null = null;
  noticeBoard: Vec | null = null;
  // Other players online (live room): their walker and pet, eased toward the last position received.
  readonly peers = new Map<string, Peer>();
  // My minds' public moments (activity starts, spoken lines), sent to the live room by main.ts.
  onMind: ((l: MindLine) => void) | null = null;
  // Speech bubbles: "pet", "me", "r<i>" (resident i), "w<id>" (wild pet), "p:<id>" (an online
  // player), "elder", "boss" -> text and seconds left.
  private readonly bubbles = new Map<string, Bubble>();

  constructor(petGenes: Genes, groundSeed = 1) {
    this.layoutIn = { me: { seed: groundSeed, slot: 0 }, roomSeed: 1, day: worldDay() };
    this.petGenes = petGenes;
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
    const npcIsle = this.world.platforms.find((p) => p.kind === "npc");
    if (npcIsle) this.elder = { pos: this.elder?.pos ?? { x: npcIsle.x, z: npcIsle.z - 1 }, sprite: this.elder?.sprite ?? drawMonster(petLook(randomGenes(77)), 24, "front", BUILDS.turtle) };
    this.landmarks = [{ art: "spr_deco_well", x: plaza.x + 7, z: plaza.z + 3 }, ...Object.values(NPC_HOMES)];
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
    this.world = villageWorld(this.layoutIn);
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
    this.beds = bedsAt(home);
    this.allBeds = this.world.platforms.filter((p) => p.ground).flatMap((p) => bedsAt(p));
    this.trees = [];
    this.treeTiles.clear();
    this.decor = [];
    this.decorTiles.clear();
    this.placeShared();
    this.placeTrees();
    this.placeSigns();
    this.placeDecor();
    this.bowl = { x: this.house.x - 2, z: this.house.z + 1.6 };
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
      ...this.betweenSpots([home.cell], { x: home.x, z: home.z + 2 }),
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
    const anchor: Record<string, [keyof Spots, string]> = { playground: ["playground", "ball"], pond: ["pond", "dock"] };
    for (const p of this.world.platforms) {
      const use = p.spots?.pond ? anchor.pond : anchor[p.kind];
      if (!use || !p.spots) continue;
      const at = p.spots[use[1]]!;
      const touches = cells.some(([hi, hj]) => Math.abs(p.cell[0] - hi) + Math.abs(p.cell[1] - hj) === 1);
      if (!touches && !(reach && findRoute(reach, { x: at.x, z: at.z + 1 }, this.canWalk, NPC_ROUTE_TILES))) continue;
      const list = (out[use[0]] ??= []);
      if (p.spots.pond) list.push(...this.fishingSpots(at, 8, 4));
      else for (let i = 0; i < 8; i++) {
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
    if (plaza) {
      // Work happens where the work is: beside real trees, and at real water when no pond is near.
      const sides = this.treeSides(plaza, 8);
      if (sides.length) out.woods = sides;
      if (!out.pond?.length) out.pond = this.fishingSpots(plaza, 16, 4);
      if (!out.playground?.length) out.playground = ring(plaza, 3.2, 8); // no pitch near the hub: the square does for a kickabout
    }
    for (const k of Object.keys(out) as (keyof Spots)[]) if (!out[k]!.length) delete out[k];
    return out;
  }

  // Water within a rod's reach to the east (1) or west (-1) of a spot, or 0: casting art throws sideways.
  waterSide(p: Vec): number {
    // Cliff and foam stand on water cells: only open water takes a line. A south coast edge or corner is cliff top.
    if ([T.water, T.pool].includes(tileAt(this.map, p.x, p.z + 1) as never)) return 0;
    const open = (x: number, z: number) => {
      const [i, j] = [Math.floor(x), Math.floor(z)];
      const cell = this.sunny.terrain.land[(j - this.map.oz) * this.map.w + i - this.map.ox] ?? 0;
      return cell === 0 || cell === seaCell(i, j);
    };
    const wet = (x: number, z: number) => [T.water, T.pool].includes(tileAt(this.map, x, z) as never) && open(x, z);
    for (let d = 1; d <= 2; d++) for (const dz of [0, 0.8]) for (const side of [1, -1]) if (wet(p.x + side * d, p.z + dz)) return side;
    return 0;
  }

  // Walkable shore cells near `at` with water beside them, nearest first.
  private fishingSpots(at: Vec, reach: number, n: number): Vec[] {
    const out: Vec[] = [];
    for (let z = Math.floor(at.z - reach); z <= at.z + reach; z++) for (let x = Math.floor(at.x - reach); x <= at.x + reach; x++) {
      const q = { x: x + 0.5, z: z + 0.5 };
      if (this.canWalk(q.x, q.z) && tileAt(this.map, q.x, q.z) !== T.bridge && this.waterSide(q)) out.push(q);
    }
    return out.sort((a, b) => Math.hypot(a.x - at.x, a.z - at.z) - Math.hypot(b.x - at.x, b.z - at.z)).filter((_, i) => i % 3 === 0).slice(0, n);
  }

  // Standing room beside the trees nearest `at`.
  private treeSides(at: Vec, n: number): Vec[] {
    const out: Vec[] = [];
    for (const tr of [...this.trees].sort((a, b) => Math.hypot(a.x - at.x, a.z - at.z) - Math.hypot(b.x - at.x, b.z - at.z))) {
      for (const dx of [-1.3, 1.3]) if (out.length < n && this.canWalk(tr.x + dx, tr.z) && findRoute({ x: at.x, z: at.z + 2 }, { x: tr.x + dx, z: tr.z }, this.canWalk, NPC_ROUTE_TILES)) out.push({ x: tr.x + dx, z: tr.z });
      if (out.length >= n) break;
    }
    return out;
  }

  // Work faces what it works on; art only ever looks sideways.
  private faceWork(mo: HumanMotion, pos: Vec, pose: Pose | null | undefined): void {
    const side = pose === "fish" ? this.waterSide(pos) : pose === "chop" ? this.treeSide(pos) : 0;
    if (side) mo.flip = side < 0;
  }

  private treeSide(p: Vec): number {
    let [best, side] = [2.2, 0];
    for (const tr of this.trees) {
      const d = Math.hypot(tr.x - p.x, tr.z - p.z);
      if (d < best) [best, side] = [d, Math.sign(tr.x - p.x) || 1];
    }
    return side;
  }

  // ---- the player's own hands -------------------------------------------------------------------------
  private work: { pose: Pose; left: number; done?: () => void } | null = null;
  onPose?: (pose: Pose | null, flip: boolean) => void; // tells the other players

  // What E can do with bare surroundings, once nothing else is in reach.
  gatherNear(): "fish" | "chop" | "herbs" | null {
    if (this.waterSide(this.player)) return "fish";
    if (this.treeSide(this.player)) return "chop";
    return tileAt(this.map, this.player.x, this.player.z) === T.flowers ? "herbs" : null;
  }

  // Play a job on the player; walking off cancels it, and `done` runs only if it finished.
  startWork(pose: Pose, secs: number, done?: () => void): void {
    this.work = { pose, left: secs, done };
    this.faceWork(this.playerMotion, this.player, pose);
    this.onPose?.(pose, this.playerMotion.flip);
  }

  private stepWork(dt: number): void {
    const w = this.work;
    if (!w) return;
    w.left -= dt;
    if (!this.moving && w.left > 0) return;
    this.work = null;
    this.onPose?.(null, this.playerMotion.flip);
    if (!this.moving) w.done?.();
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
      const side = p.rect ? "s" : Math.abs(ci) >= Math.abs(cj) ? (ci > 0 ? "w" : "e") : cj > 0 ? "n" : "s";
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

  // Trees ring each island inside the sand, never on paths, plazas or bridges, and never in a 2-tile gap.
  private placeTrees(): void {
    const m = this.map;
    if (this.world.things) {
      for (const t of this.world.things) if (t.kind === "tree") {
        this.trees.push({ x: t.x, z: t.z });
        this.treeTiles.add(Math.floor(t.z - m.oz) * m.w + Math.floor(t.x - m.ox));
      }
      return;
    }
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
        if (SHORE.some(([di, dj]) => { const c = kindAt(i + di, j + dj); return c === T.water || c === T.pool || c === T.bridge || c === T.ledge; })) continue;
        if (p.ground && Math.hypot((x - p.x) / 7.5, (z - p.z + 1) / 5) < 1) continue;
        if (p.spots && Object.values(p.spots).some((s) => Math.abs(s.x - x) < 3.5 && Math.abs(s.z - z) < 3.5)) continue;
        if (p.kind === "plaza" && Math.abs(x - p.x) < 4 && Math.abs(z - p.z) < 3) continue;
        if (this.noticeBoard && Math.abs(x - this.noticeBoard.x) < 2 && Math.abs(z - this.noticeBoard.z) < 2) continue;
        if (this.houses.some((hs) => Math.abs(x - hs.x) < 5 && Math.abs(z - hs.z + 2) < 5)) continue;
        if (this.nearPath(i, j)) continue;
        if (Math.abs(x - this.house.x) < 9 && Math.abs(z - this.house.z + 3) < 7) continue;
        if (this.stall && Math.abs(x - this.stall.x) < 3.5 && Math.abs(z - this.stall.z + 1) < 3.5) continue;
        if (this.landmarks.some((l) => Math.abs(x - l.x) < 3.5 && Math.abs(z - l.z + 1) < 3.5)) continue;
        if (this.allBeds.some((b) => Math.abs(b.x + 0.5 - x) < 2.5 && Math.abs(b.z + 0.5 - z) < 2.5)) continue;
        candidates.push({ x, z });
      }
      // Shuffle once per platform, then grow compact patches with trees about two tiles apart. The draw code's
      // position hash continues to mix the existing tree kinds. No isolated outliers fill the gaps.
      for (let n = candidates.length - 1; n > 0; n--) {
        const q = Math.floor(rng() * (n + 1));
        [candidates[n], candidates[q]] = [candidates[q]!, candidates[n]!];
      }
      const clumps = (p.ground ? 8 : 3) + Math.floor(rng() * 2);
      for (let c = 0; c < clumps; c++) {
        const want = (p.ground ? 18 : 12) + Math.floor(rng() * 8);
        const available = candidates.filter((v) => !this.trees.some((t) => Math.abs(t.x - v.x) < 3 && Math.abs(t.z - v.z) < 3));
        let best: Vec[] = [];
        for (const anchor of available.slice(0, 120)) { // candidates are shuffled; a sample keeps big grounds fast
          const dist = (v: Vec) => Math.hypot(v.x - anchor.x, v.z - anchor.z) + hash2(v.x, v.z, 77) * 3; // uneven reach: a blob, not a block
          const patch = available.filter((v) => Math.abs(v.x - anchor.x) <= CLUMP && Math.abs(v.z - anchor.z) <= CLUMP).sort((a, b) => dist(a) - dist(b));
          const group: Vec[] = [anchor];
          while (group.length < want) {
            const v = patch.find((q) => group.every((t) => Math.max(Math.abs(t.x - q.x), Math.abs(t.z - q.z)) >= 2) && group.some((t) => Math.max(Math.abs(t.x - q.x), Math.abs(t.z - q.z)) <= 3));
            if (!v) break;
            group.push(v);
          }
          if (group.length > best.length) best = group;
          if (best.length === want) break;
        }
        // Crowded islands may have less room; clearances take priority over the target count.
        if (best.length < 2) break;
        for (const t of best) {
          this.trees.push({ x: t.x, z: t.z }); // on the tile grid; the clump's outline is what looks natural
          this.treeTiles.add(Math.floor(t.z - m.oz) * m.w + Math.floor(t.x - m.ox));
        }
      }
    }
  }

  // Decor keeps clear of houses, beds, the stall, trees and name signs (they take part in the walk check).
  private placeDecor(): void {
    const m = this.map;
    const near = (v: Vec, x: number, z: number, d: number) => Math.abs(v.x - x) < d && Math.abs(v.z - z + 1) < d;
    const reserved = (x: number, z: number) =>
      [this.house, ...this.houses].some((h) => near(h, x, z, 5)) ||
      this.landmarks.some((l) => near(l, x, z, 3)) ||
      (!!this.stall && near(this.stall, x, z, 3)) ||
      this.allBeds.some((b) => Math.abs(b.x + 0.5 - x) < 2 && Math.abs(b.z + 0.5 - z) < 2) ||
      this.signs.some((sg) => Math.abs(sg.x - x) < 1.5 && Math.abs(sg.z - z) < 1.5);
    this.decor = this.world.things
      ? this.world.things.filter((t) => t.kind !== "tree").map((t) => ({ kind: t.kind as DecorPiece["kind"], x: t.x, z: t.z, tiles: [Math.floor(t.z - m.oz) * m.w + Math.floor(t.x - m.ox)], platform: "" }))
      : placeDecor(this.world, m, (x, z) => reserved(x, z) || this.treeTiles.has(Math.floor(z - m.oz) * m.w + Math.floor(x - m.ox)), reserved);
    // Feature clearings take priority over trees, like the pack's fields and mill yards.
    // Farm ground is the pack's light dirt: real beds with a tile around them, and the decorative fields.
    const soil = (m.soil = new Uint8Array(m.w * m.h));
    for (const p of this.world.platforms) if (p.ground) {
      const beds = bedsAt(p);
      const { x, z } = beds[0]!;
      const last = beds[beds.length - 1]!;
      // One plain block of dirt with a tile of edge all round, nothing else on it (bug 41).
      for (let dz = -1; dz <= last.z - z + 1; dz++) for (let dx = -1; dx <= last.x - x + 1; dx++) {
        const k = (z + dz - m.oz) * m.w + x + dx - m.ox;
        if (m.kind[k] === T.flowers || m.kind[k] === T.tall) m.kind[k] = T.grass;
        if (m.kind[k] === T.grass || m.kind[k] === T.path) soil[k] = 1;
      }
    }
    const clearing = new Set<number>();
    for (const d of this.decor.filter((d) => d.field || d.kind === "windmill")) {
      for (const k of [...d.tiles, ...(d.soil ?? [])]) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) clearing.add(k + dz * m.w + dx);
    }
    this.trees = this.trees.filter((t) => !clearing.has(Math.floor(t.z - m.oz) * m.w + Math.floor(t.x - m.ox)));
    if (!this.world.things) this.trees = this.trees.filter((t, _, trees) => trees.some((other) => other !== t && Math.max(Math.abs(t.x - other.x), Math.abs(t.z - other.z)) <= 4));
    this.treeTiles.clear();
    for (const t of this.trees) this.treeTiles.add(Math.floor(t.z - m.oz) * m.w + Math.floor(t.x - m.ox));
    for (const d of this.decor) {
      for (const k of d.tiles) this.decorTiles.add(k);
      for (const k of d.soil ?? []) {
        m.kind[k] = T.path;
        soil[k] = 1;
      }
    }
    // Decorative fields add dirt after the initial terrain pass.
    this.sunny = buildSunny(m);
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
  npcSprite(id: Npc): Sprite {
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
    this.petGenes = g;
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
    if (CLOUD_CHAT) this.npcs.cloud = (npc, line, scene, mind) => cloudLine(npc, line, scene, mind);
    this.npcs.people = () => [{ id: this.npcs?.me ?? "me", name: this.myName, pos: this.player }, ...[...this.peers].map(([id, p]) => ({ id, name: p.name, pos: p.pos }))];
    this.npcs.pets = () => [
      { id: "pet", name: this.petName, pos: this.pet, busy: this.moving },
      ...this.residents.map((r) => ({ id: r.agent.id, name: r.agent.name, pos: r.agent.pos, busy: r.agent.state === "walk" })),
      ...[...this.peers].map(([id, p]) => ({ id: `pet:${id}`, name: `${p.name}'s pet`, pos: p.pet })),
    ];
    this.minds.sceneOf = this.npcs.hub.sceneOf = (id, withPos) => this.sceneFor(id, withPos);
    this.npcs.hub.placesOf = () => this.places();
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
    const near = this.places().filter((p) => !p.doing && !/^[A-Z]/.test(p.name) && p.name !== place).sort((a, b) => Math.hypot(a.x - me.pos.x, a.z - me.pos.z) - Math.hypot(b.x - me.pos.x, b.z - me.pos.z)).slice(0, 3);
    return cleanScene(`${sharedScene(me.pos, withPos ?? me.pos, others, place, when)} Places: ${near.map((p) => `${p.name} ${compass(me.pos, p)}`).join(", ")}.`);
  }

  // The scene for a chat between me (the player) and an NPC, as both see it here.
  // Everywhere a villager can point to, from the map as it is right now.
  private places(): Place[] {
    const out: Place[] = [];
    const add = (name: string, words: string[], at: Vec | undefined | null, doing?: string) => {
      if (at) out.push({ name, words, x: at.x, z: at.z, doing });
    };
    const spots = this.npcSpots();
    const inland = spots.pond?.[0] && this.world.platforms.some((p) => p.spots?.pond);
    add(inland ? "the pond" : "the shore", ["pond", "lake", "fishing spot", "shore", "water"], spots.pond?.[0]);
    add("the market stall", ["market", "stall", "shop"], this.stall);
    add("the town board", ["town board", "notice board", "board"], this.noticeBoard);
    add("the woods", ["woods", "forest", "trees"], spots.woods?.[0]);
    for (const p of this.world.platforms) {
      const words = [p.label.toLowerCase().replace(/ \(away\)$/, "")];
      if (p.kind === "plaza") words.push("square", "plaza", "village", "town");
      if (p.kind === "npc") words.push("elder's", "elders", "elder's house");
      if (p.owner && p.owner !== "me") words.push(`${p.label.split("'")[0]!.toLowerCase()}'s`, `${p.label.split("'")[0]!.toLowerCase()}s place`);
      add(p.label.replace(/ \(away\)$/, ""), words, p);
    }
    for (const a of this.npcs?.v.agents ?? []) add(a.name, [a.name.toLowerCase()], a.pos, a.state === "do" && a.act !== "wander" ? ACTIVITY.get(a.act!)?.label : undefined);
    for (const p of this.peers.values()) add(p.name, [p.name.toLowerCase()], p.pos);
    return out;
  }

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
      if (a.state === "do" && ACTIVITY.get(a.act!)?.indoors) continue; // at home, behind the door
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
    this.player = { x: this.house.x + HOME_DOOR_DX, z: this.house.z + 0.9 };
    this.pet = { x: this.house.x + HOME_DOOR_DX + 0.8, z: this.house.z + 1.4 };
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
    return Math.abs(this.player.x - this.house.x - HOME_DOOR_DX) < 0.8 && this.player.z > this.house.z && this.player.z < this.house.z + 1.2 && this.playerMotion.dir === 3;
  }

  private footprint(art: string): [number, number] {
    const [w, h] = stampSize(art);
    return [w / 32, h / 32 + 0.6]; // half width, depth in tiles (the roof leans back over open ground)
  }

  indoors = false; // drawing the world around the house: the house and I are on the interior's layer
  underBubbles?: () => void; // the screen's own panels: speech draws over them

  // Standing in a dance that has started, you dance too.
  private partyPose(): Pose | null {
    const near = this.npcs?.v.gatherings.some((g) => g.act === "dance" && g.started && Math.hypot(g.at.x - this.player.x, g.at.z - this.player.z) < 5);
    return near ? "dance" : null;
  }

  readonly canWalk = (x: number, z: number): boolean => {
    if (!tileWalkable(this.map, x, z) || railBlocks(this.map, x, z) || cornerBlocks(this.map, x, z)) return false;
    const [dx, dz] = [x - this.house.x, z - this.house.z];
    if (HOME_BLOCKS.some(([x0, x1, z0, z1]) => dx > x0 && dx < x1 && dz > z0 && dz < z1)) return false;
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
    if (this.allBeds.some((b) => x >= b.x - 0.1 && x < b.x + 1.1 && z >= b.z - 0.1 && z < b.z + 1.1)) return false;
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
    this.peers.set(id, { name, genes, look: humanLook(liveName(genes)), pos: { x, z }, motion: newHumanMotion({ x, z }), pet: { x: px, z: pz }, to: { x, z, px, pz }, sprite: drawMonster(petLook(genes), OVERWORLD_MON, "front"), pose: null, flip: false });
  }

  posePeer(id: string, pose: Pose | null, flip: boolean): void {
    const p = this.peers.get(id);
    if (p) Object.assign(p, { pose, flip });
  }

  movePeer(id: string, x: number, z: number, px: number, pz: number): void {
    const p = this.peers.get(id);
    if (p) p.to = { x, z, px, pz };
  }

  get me(): { x: number; z: number; px: number; pz: number } {
    return { x: this.player.x, z: this.player.z, px: this.pet.x, pz: this.pet.z };
  }

  // The pet stays put as an egg. Afterwards it follows, and what it does when you stop shows its mood.
  private stepPet(dt: number): void {
    this.petStill = this.moving ? 0 : this.petStill + dt;
    this.petGlad = Math.max(0, this.petGlad - dt);
    if (this.hatchLeft > 0) return void (this.hatchLeft -= dt);
    const moved = followStep(this.pet, this.player, dt, this.canWalk);
    const free = unstick(this.pet, moved, this.player, this.petHeld, dt, this.canWalk);
    this.pet = free.pet;
    this.petHeld = free.held;
  }

  // The egg sits in the open in front of you, where you will see it.
  startHatch(): void {
    this.hatchLeft = HATCH_TIME;
    const spot = [3, 4, -3].map((dz) => ({ x: this.player.x, z: this.player.z + dz })).find((v) => this.canWalk(v.x, v.z));
    if (spot) this.pet = spot;
  }

  cheerPet(): void {
    this.petGlad = GLAD_TIME;
  }

  update(dt: number, keys: ReadonlySet<string>): Wild | null {
    const d = keyDir(keys);
    this.moving = d.x !== 0 || d.z !== 0;
    if (this.moving) {
      const speed = (keys.has("shift") ? HUMAN_RUN_SPEED : HUMAN_WALK_SPEED) * dt;
      this.player = slide(this.player, d.x * speed, d.z * speed, this.canWalk);
    }
    this.stepWork(dt);
    stepHumanMotion(this.playerMotion, this.player, dt, this.work?.pose ?? (this.moving ? null : this.partyPose()));
    this.moving = this.playerMotion.walking;
    this.stepPet(dt);
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
      for (const a of this.npcs.v.agents) {
        const pose = a.state === "do" ? ACTIVITY.get(a.act!)?.pose ?? null : null;
        const mo = this.npcMotions.get(a.id as Npc)!;
        stepHumanMotion(mo, a.pos, dt, pose);
        this.faceWork(mo, a.pos, pose);
      }
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
      stepHumanMotion(p.motion, p.pos, dt, p.pose);
      if (p.pose) p.motion.flip = p.flip;
      p.pet.x += (p.to.px - p.pet.x) * k8;
      p.pet.z += (p.to.pz - p.pet.z) * k8;
    }
    return met;
  }

  // The world around the house while you are inside: `(sx, sy)` is where the house's foot sits on screen.
  drawAround(g: CanvasRenderingContext2D, sw: number, sh: number, t: number, sx: number, sy: number): void {
    const cam = this.cam;
    this.cam = { x: this.house.x + (sw / 2 - sx) / TILE, z: this.house.z + (sh / 2 - sy) / TILE };
    this.indoors = true;
    this.draw(g, sw, sh, t);
    this.indoors = false;
    this.cam = cam;
  }

  draw(g: CanvasRenderingContext2D, sw: number, sh: number, t: number): void {
    const scene = this.buildScene();
    for (const [id, held] of this.view.draw(scene, g, sw, sh, t)) {
      const b = this.bubbles.get(id);
      if (b) b.held = held;
    }
    if (!scene.inspector) this.inspect = null;
  }

  // One frame's worth of plain data for a view (game/ports.ts).
  buildScene(): Scene {
    const now = gameTime(this.life.t);
    const people: ScenePerson[] = [];
    const pets: ScenePet[] = [];
    if (!this.indoors) {
      people.push({ id: "me", name: this.myName, kind: "me", x: this.player.x, z: this.player.z, dir: this.playerMotion.dir, walking: this.moving, pose: this.playerMotion.pose, look: this.myLook });
      const hatching = this.hatchLeft > 0;
      pets.push({ id: "pet", kind: "mine", x: this.pet.x, z: this.pet.z, genes: this.petGenes, pose: hatching ? null : petMood(this.petStill, now.phase === "night", this.petGlad), ...(hatching ? { hatch: 1 - this.hatchLeft / HATCH_TIME } : {}) });
    }
    for (const [id, p] of this.peers) {
      people.push({ id: `p:${id}`, name: p.name, kind: "peer", x: p.pos.x, z: p.pos.z, dir: p.motion.dir, walking: p.motion.walking, pose: p.motion.pose, look: p.look });
      pets.push({ id: `p:${id}`, kind: "peer", x: p.pet.x, z: p.pet.z, genes: p.genes, pose: null });
    }
    for (const a of this.npcs?.v.agents ?? []) {
      const motion = this.npcMotions.get(a.id as Npc) ?? newHumanMotion(a.pos);
      people.push({ id: a.id, name: a.name, kind: "npc", x: a.pos.x, z: a.pos.z, dir: motion.dir, walking: motion.walking, pose: motion.pose, look: NPC_LOOKS[a.id as Npc] });
    }
    for (const [id, pos] of this.npcPets) if (this.npcs?.hasPet[id]) pets.push({ id: `n:${id}`, kind: "npc", x: pos.x, z: pos.z, genes: null, pose: null });
    for (const w of this.wilds) pets.push({ id: `w${w.id}`, kind: "wild", x: w.pos.x, z: w.pos.z, genes: w.genes, pose: null });
    this.residents.forEach((r, k) => pets.push({ id: `r${k}`, kind: "resident", x: r.agent.pos.x, z: r.agent.pos.z, genes: r.genes, pose: r.agent.state === "do" ? ACTIVITY.get(r.agent.act!)!.pose : null }));
    const props: SceneProp[] = [
      ...this.trees.map((t) => ({ kind: "tree", x: t.x, z: t.z })),
      ...this.decor.map((d) => ({ kind: d.kind, x: d.x, z: d.z })),
      ...this.houses.map((h) => ({ kind: "house", x: h.x, z: h.z })),
      ...this.landmarks.map((l) => ({ kind: LANDMARK_PROP[l.art] ?? "house", x: l.x, z: l.z })),
      ...this.signs.map((s) => ({ kind: "sign", x: s.x, z: s.z, text: s.text })),
      ...this.world.platforms.flatMap((p) => Object.entries(p.spots ?? {}).map(([kind, at]) => ({ kind, x: at.x, z: at.z }))),
      ...this.life.messes.map((m) => ({ kind: "mess", x: m.pos.x, z: m.pos.z })),
      { kind: "bowl", x: this.bowl.x, z: this.bowl.z },
    ];
    if (!this.indoors) props.push({ kind: "home", x: this.house.x, z: this.house.z });
    if (this.stall) props.push({ kind: "stall", x: this.stall.x, z: this.stall.z });
    if (this.noticeBoard) props.push({ kind: "board", x: this.noticeBoard.x, z: this.noticeBoard.z });
    const plaza = this.world.platforms.find((p) => p.kind === "plaza");
    // A birthday promised for today dresses the plaza, and stays up through the party.
    const birthday = [...(this.npcs?.hub.minds.values() ?? [])].some((m) => m.mem.promises.some((c) => (c.state === "open" || c.state === "kept") && c.day === now.day && /birthday/i.test(c.occasion)));
    if (plaza && birthday) props.push({ kind: "bunting", x: plaza.x, z: plaza.z - 2.5 }, { kind: "balloon", x: plaza.x - 3.5, z: plaza.z - 1.5 }, { kind: "balloon", x: plaza.x + 3.5, z: plaza.z - 1.5 }, { kind: "balloon", x: plaza.x + 3.5, z: plaza.z + 1.5 });
    const beds: SceneBed[] = this.beds.map((b, i) => {
      const p = this.farm?.plots[i];
      return { x: b.x, z: b.z, crop: p?.crop ?? "", stage: p?.stage ?? 0, wet: !!p?.wetUntil, dry: !!p && !p.wetUntil && needsWater(p) };
    });
    for (const p of this.world.platforms) {
      if (!p.ground || p.owner === "me") continue;
      const farm = this.peerFarms.get(p.owner ?? "");
      bedsAt(p).forEach((b, i) => {
        const [crop, stage] = farm?.[i] ?? ["", 0];
        beds.push({ x: b.x, z: b.z, crop, stage, wet: false, dry: false });
      });
    }
    const bubbles: SceneBubble[] = [];
    for (const [who, b] of this.bubbles) {
      const pos = who === "pet" ? this.pet : who === "me" ? this.player : who.startsWith("p:") ? this.peers.get(who.slice(2))?.pos : who === "elder" || who === "n:elder" ? this.elder?.pos : who.startsWith("n:") ? this.npcs?.v.agents.find((a) => a.id === who.slice(2))?.pos : who.startsWith("r") ? this.residents[Number(who.slice(1))]?.agent.pos : this.wilds.find((w) => `w${w.id}` === who)?.pos;
      if (!pos) continue;
      const head = this.speaker(who);
      bubbles.push({ id: who, x: pos.x, z: pos.z, head: b.thought ? `${head} thinks` : head && b.to ? `${head} > ${b.to}` : head, text: b.text, thought: !!b.thought, first: who === "me" || b.to === this.myName });
    }
    return {
      map: this.map,
      cam: this.cam,
      indoors: this.indoors,
      clock: { day: now.day, hour: now.hour, phase: now.phase, label: `${weekday(now.day)} ${clockLabel(now.hour)}` },
      day: this.alwaysDay,
      showNames: this.ui.names,
      showMap: this.ui.map,
      people, pets, props, beds, bubbles,
      hint: this.hintNow(),
      banner: this.bannerT > 0 && this.place ? { text: this.place, left: this.bannerT } : null,
      inspector: this.inspected(),
      panels: this.panels,
      chips: this.chips,
    };
  }

  private hintNow(): string | null {
    const bed = this.bedNear();
    return this.indoors ? null : this.atDoor()
      ? "E: GO IN"
      : bed >= 0 && this.farm
        ? bedHint(this.farm, bed)
        : this.nearStall() ? "E: MARKET" : this.nearBoard() ? "E: BOARD" : this.npcNear() ? "E: TALK" : this.messNear() !== null ? "E: CLEAN" : this.peerNear() ? "E: SAY HI" : this.mindNear() && !this.inspect ? "I: MIND" : this.work ? "" : GATHER_HINT[this.gatherNear() ?? ""] ?? "";
  }

  private inspected(): SceneInspector | null {
    const npc = !!this.inspect && !!this.npcs?.hub.minds.has(this.inspect);
    const [hub, v] = npc ? [this.npcs!.hub, this.npcs!.v] : [this.minds, this.life];
    const mind = this.inspect ? hub?.minds.get(this.inspect) : undefined;
    const agent = this.inspect ? v.agents.find((a) => a.id === this.inspect) : undefined;
    if (!mind || !agent) return null;
    const nameOf = (id: string) => hub?.minds.get(id)?.persona.name ?? id, where = npc ? `${this.mindWhere}, for all` : this.mindWhere;
    return { mind, agent, rel: v.rel, nameOf, where, lines: (wrapLine) => inspectorLines(mind, agent, v.rel, nameOf, where, wrapLine) };
  }
}

// A village plot (it has a rect) keeps its field and the field's edge inside the plot, clear of the road's edge
// tiles: two rows of three side by side, as on the pack's demo farm (bug 41). The set-aside mosaic grounds keep theirs.
export const bedsAt = (home: Vec & { rect?: unknown }): Vec[] => Array.from({ length: PLOTS }, (_, i) => home.rect
  ? { x: Math.floor(home.x) + 1 + (i % 3), z: Math.floor(home.z) - 2 + Math.floor(i / 3) }
  : { x: Math.floor(home.x) + 3 + (i % 3), z: Math.floor(home.z) - 2 + Math.floor(i / 3) * 2 });

const GATHER_HINT: Record<string, string> = { fish: "E: FISH", chop: "E: CHOP", herbs: "E: PICK HERBS" };

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

interface Peer {
  name: string;
  genes: Genes;
  pos: Vec;
  motion: HumanMotion;
  pet: Vec;
  to: { x: number; z: number; px: number; pz: number };
  sprite: HTMLCanvasElement;
  look: HumanLook;
  pose: Pose | null;
  flip: boolean;
}
