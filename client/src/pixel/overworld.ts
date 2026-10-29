// The top-down overworld scene: tile map, trees, the player and the following pet, a pixel-snapped follow
// camera and the place banner. Game rules (movement, the map) come from ../world; this file only decides
// what is where on screen.

import { generateWorld, platformAt, type WorldMap } from "../world/layout";
import { followStep, keyDir, slide, stepToward, WALK_SPEED, type Vec } from "../world/movement";
import { petLook, randomGenes } from "../game/genes";
import type { Genes } from "../sim/ghost";
import { ARCHETYPES, type ArchetypeId } from "../sim/types";
import { drawCrop, drawMapTile, drawProp, hasArt, HOUSE, img, MARKET_STALL, makePlayer, PAL, TREE, type Sprite } from "./art";
import { needsWater, PLOTS, type Farm } from "../game/farm";
import { BUILDS, drawMonster } from "./monster";
import { drawFrame, drawText, GLYPH, wrap } from "./text";
import { buildTileMap, hash2, T, TILE, tileAt, tileWalkable, type TileMap } from "./tiles";

type Dir = 0 | 1 | 2 | 3; // down, left, right, up (sprite rows)

export const OVERWORLD_MON = 20; // px: monsters in the overworld
const WILD_PER_MEADOW = 3;
const MEET_DIST = 1.0;

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

// Owned pets that are not out with you live at your corner: they wander a little and do small things.
interface Resident {
  sprite: HTMLCanvasElement;
  pos: Vec;
  target: Vec;
  wait: number;
  act: string; // bubble text while idle: sleeping, humming, curious
}
const ACTS = ["z", "zz", "...", "!", "?", "*"];

export class Overworld {
  readonly world: WorldMap;
  readonly map: TileMap;
  readonly trees: Vec[] = [];
  private readonly treeTiles = new Set<number>();
  player: Vec;
  pet: Vec;
  private dir: Dir = 0;
  private moving = false;
  private walkT = 0;
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
  // The ghost stone on the event island: touch it to fight a random shared ghost.
  ghostStone: { pos: Vec; sprite: HTMLCanvasElement; cool: number } | null = null;
  // Other players online (live room): their walker and pet, eased toward the last position received.
  readonly peers = new Map<string, Peer>();
  // Speech bubbles: "pet", "r<i>" (resident i) or "w<id>" (wild pet) -> text and seconds left.
  private readonly bubbles = new Map<string, { text: string; t: number }>();

  constructor(petGenes: Genes) {
    this.world = generateWorld();
    this.map = buildTileMap(this.world);
    const home = this.world.platforms.find((p) => p.kind === "home")!;
    this.house = { x: home.x, z: home.z - 2.5 };
    this.beds = Array.from({ length: PLOTS }, (_, i) => ({ x: Math.floor(home.x) + 3 + (i % 3), z: Math.floor(home.z) - 4 + Math.floor(i / 3) }));
    const market = this.world.platforms.find((p) => p.kind === "market");
    if (market) this.stall = { x: market.x, z: market.z - 1 };
    this.placeTrees();
    const bossIsle = this.world.platforms.find((p) => p.kind === "boss");
    if (bossIsle) this.boss = { pos: { x: bossIsle.x, z: bossIsle.z - 1 }, sprite: drawMonster(petLook(randomGenes(4242)), 40, "front", BUILDS.bully), cool: 0 };
    const eventIsle = this.world.platforms.find((p) => p.kind === "event");
    if (eventIsle) this.ghostStone = { pos: { x: eventIsle.x, z: eventIsle.z - 1 }, sprite: ghostSprite(), cool: 0 };
    const npcIsle = this.world.platforms.find((p) => p.kind === "npc");
    if (npcIsle) this.elder = { pos: { x: npcIsle.x, z: npcIsle.z - 1 }, sprite: drawMonster(petLook(randomGenes(77)), 24, "front", BUILDS.turtle) };
    this.player = { x: home.x + 0.5, z: home.z + 3.5 };
    this.pet = { x: home.x - 1, z: home.z + 4 };
    this.cam = { ...this.player };
    this.petSprite = drawMonster(petLook(petGenes), OVERWORLD_MON, "front");
    for (const p of this.world.platforms) if (p.kind === "wild") for (let i = 0; i < WILD_PER_MEADOW; i++) this.spawnWild(p.x, p.z, p.r);
  }

  // Trees ring each island inside the sand, never on paths, plazas or bridges, and never in a 2-tile gap.
  private placeTrees(): void {
    const m = this.map;
    for (let j = 1; j < m.h - 1; j++) {
      for (let i = 1; i < m.w - 1; i++) {
        const k = m.kind[j * m.w + i];
        if (k !== T.grass && k !== T.tall) continue;
        const x = m.ox + i + 0.5;
        const z = m.oz + j + 0.5;
        const p = platformAt(this.world, x, z);
        if (!p) continue;
        const d = Math.hypot(x - p.x, z - p.z);
        const ring = d > p.r - 4 && d < p.r - 1.5;
        if (!(ring ? hash2(i, j, 9) < 0.22 : hash2(i, j, 9) < 0.012)) continue;
        if (this.nearPath(i, j)) continue;
        if (this.trees.some((t) => Math.abs(t.x - x) < 2.5 && Math.abs(t.z - z) < 2.5)) continue;
        if (Math.abs(x - this.house.x) < 3.5 && Math.abs(z - this.house.z + 1) < 3.5) continue;
        if (this.stall && Math.abs(x - this.stall.x) < 3.5 && Math.abs(z - this.stall.z + 1) < 3.5) continue;
        if (this.beds.some((b) => Math.abs(b.x + 0.5 - x) < 2.5 && Math.abs(b.z + 0.5 - z) < 2.5)) continue;
        this.trees.push({ x, z });
        this.treeTiles.add(j * m.w + i);
      }
    }
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

  setPet(g: Genes, arch?: ArchetypeId): void {
    this.petSprite = drawMonster(petLook(g), OVERWORLD_MON, "front", arch ? BUILDS[arch] : undefined);
  }

  setResidents(mons: readonly { genes: Genes; arch?: ArchetypeId }[]): void {
    const home = this.world.platforms.find((p) => p.kind === "home")!;
    this.residents = mons.map((m, i) => {
      const a = (i / Math.max(1, mons.length)) * Math.PI * 2 + 0.6;
      const pos = { x: home.x + Math.cos(a) * 5.5, z: home.z + Math.sin(a) * 5.5 };
      return { sprite: drawMonster(petLook(m.genes), OVERWORLD_MON, "front", m.arch ? BUILDS[m.arch] : undefined), pos, target: { ...pos }, wait: 1 + i, act: "" };
    });
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

  say(who: string, text: string, secs = 3.5): void {
    this.bubbles.set(who, { text, t: secs });
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

  nearElder(): boolean {
    return !!this.elder && Math.hypot(this.elder.pos.x - this.player.x, this.elder.pos.z - this.player.z) < 2.2;
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
    this.dir = 0;
  }

  // The bed the player is standing next to and facing (or on), if any.
  bedNear(): number {
    const f = [[0, 0.7], [-0.7, 0], [0.7, 0], [0, -0.7]][this.dir]!;
    const x = this.player.x + f[0]!;
    const z = this.player.z + f[1]!;
    return this.beds.findIndex((b) => x >= b.x && x < b.x + 1 && z >= b.z && z < b.z + 1);
  }

  atDoor(): boolean {
    return Math.abs(this.player.x - this.house.x) < 0.8 && this.player.z > this.house.z && this.player.z < this.house.z + 1.2 && this.dir === 3;
  }

  private drawBeds(g: CanvasRenderingContext2D, toScreen: (x: number, z: number) => [number, number], t: number): void {
    const crops = img("tile-crop-states");
    this.beds.forEach((b, i) => {
      const [sx, sy] = toScreen(b.x, b.z);
      const p = this.farm?.plots[i];
      g.drawImage(crops, 0, 0, TILE, TILE, sx, sy, TILE, TILE);
      g.fillStyle = PAL.wood; // rake over the seed mark: soil only
      g.fillRect(sx + 4, sy + 4, 8, 8);
      g.fillStyle = PAL.woodD;
      g.fillRect(sx + 4, sy + 7, 8, 1);
      if (p?.crop) drawCrop(g, p.crop, p.stage, sx, sy - 3);
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

  readonly canWalk = (x: number, z: number): boolean => {
    if (!tileWalkable(this.map, x, z)) return false;
    if (Math.abs(x - this.house.x) < 1.6 && z < this.house.z + 0.2 && z > this.house.z - 2.2) return false;
    if (this.stall && Math.abs(x - this.stall.x) < 1.4 && z < this.stall.z + 0.2 && z > this.stall.z - 1.4) return false;
    if (this.beds.some((b) => x >= b.x - 0.1 && x < b.x + 1.1 && z >= b.z - 0.1 && z < b.z + 1.1)) return false;
    const i = Math.floor(x - this.map.ox);
    const j = Math.floor(z - this.map.oz);
    return !this.treeTiles.has(j * this.map.w + i);
  };

  // Returns the wild monster the player just bumped into, if any.
  addPeer(id: string, name: string, genes: Genes, x: number, z: number, px: number, pz: number): void {
    this.peers.set(id, { name, pos: { x, z }, pet: { x: px, z: pz }, to: { x, z, px, pz }, sprite: drawMonster(petLook(genes), OVERWORLD_MON, "front") });
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
      this.player = slide(this.player, d.x * WALK_SPEED * dt, d.z * WALK_SPEED * dt, this.canWalk);
      this.dir = Math.abs(d.x) > Math.abs(d.z) ? (d.x < 0 ? 1 : 2) : d.z < 0 ? 3 : 0;
      this.walkT += dt;
    }
    this.pet = followStep(this.pet, this.player, dt, this.canWalk);
    // Camera eases toward the player; drawing snaps it to whole pixels.
    const k = 1 - Math.exp(-dt * 8);
    this.cam = { x: this.cam.x + (this.player.x - this.cam.x) * k, z: this.cam.z + (this.player.z - this.cam.z) * k };
    const here = platformAt(this.world, this.player.x, this.player.z)?.label ?? "";
    if (here && here !== this.place) this.bannerT = 2.5;
    this.place = here || this.place;
    this.bannerT = Math.max(0, this.bannerT - dt);
    for (const [k, b] of this.bubbles) if ((b.t -= dt) <= 0) this.bubbles.delete(k);
    const home = this.world.platforms.find((p) => p.kind === "home")!;
    for (const r of this.residents) {
      r.wait -= dt;
      if (r.wait > 0) continue;
      const s = stepToward(r.pos, r.target, WALK_SPEED * 0.25 * dt);
      r.pos = slide(r.pos, s.dx, s.dz, this.canWalk);
      r.act = "";
      if (s.arrived) {
        r.wait = 3 + Math.random() * 5;
        r.act = ACTS[Math.floor(Math.random() * ACTS.length)]!;
        const a = Math.random() * Math.PI * 2;
        const d = 3 + Math.random() * 5;
        r.target = { x: home.x + Math.cos(a) * d, z: home.z + Math.sin(a) * d };
      }
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
      p.pos.x += (p.to.x - p.pos.x) * k8;
      p.pos.z += (p.to.z - p.pos.z) * k8;
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
    g.fillStyle = PAL.water;
    g.fillRect(0, 0, sw, sh);
    const i0 = Math.floor(camX / TILE) - 1; // world tile coords (tileAt subtracts the map origin)
    const j0 = Math.floor(camY / TILE) - 1;
    for (let j = j0; j <= j0 + Math.ceil(sh / TILE) + 2; j++) {
      for (let i = i0; i <= i0 + Math.ceil(sw / TILE) + 2; i++) {
        const [sx, sy] = toScreen(i, j);
        drawMapTile(g, m, i, j, sx, sy, t);
      }
    }
    this.drawBeds(g, toScreen, t);
    // Sprites sorted by their feet, so things lower on screen stand in front.
    const items: { z: number; draw: () => void }[] = [];
    for (const tr of this.trees) {
      const [sx, sy] = toScreen(tr.x, tr.z);
      if (sx < -32 || sy < -48 || sx > sw + 32 || sy > sh + 48) continue;
      items.push({ z: tr.z, draw: () => drawProp(g, TREE, sx, sy + 4) });
    }
    {
      const [hx, hy] = toScreen(this.house.x, this.house.z);
      items.push({ z: this.house.z, draw: () => drawProp(g, HOUSE, hx, hy) });
    }
    const [px, py] = toScreen(this.player.x, this.player.z);
    const pf = this.moving ? Math.floor(this.walkT * 8) % this.playerSprite.frames : 0;
    items.push({ z: this.player.z, draw: () => g.drawImage(this.playerSprite.img, pf * 16, this.dir * 24, 16, 24, px - 8, py - 22, 16, 24) });
    const half = OVERWORLD_MON / 2;
    for (const p of this.peers.values()) {
      const [ax, ay] = toScreen(p.pos.x, p.pos.z);
      const [bx, by] = toScreen(p.pet.x, p.pet.z);
      items.push({ z: p.pos.z, draw: () => {
        g.globalAlpha = 0.85;
        g.drawImage(this.playerSprite.img, 0, 0, 16, 24, ax - 8, ay - 22, 16, 24);
        g.globalAlpha = 1;
        const tag = p.name.slice(0, 10).toUpperCase();
        drawText(g, tag, ax - (tag.length * GLYPH) / 2, ay - 32, PAL.panel);
      } });
      items.push({ z: p.pet.z, draw: () => g.drawImage(p.sprite, bx - half, by - OVERWORLD_MON + 2) });
    }
    if (this.stall) {
      const [mx, my] = toScreen(this.stall.x, this.stall.z);
      items.push({ z: this.stall.z, draw: () => drawProp(g, MARKET_STALL, mx, my + 4) });
    }
    if (this.elder && hasArt("elder-npc")) {
      // ImageGen Elder: two 16x24 idle frames, 500 ms each.
      const [nx, ny] = toScreen(this.elder.pos.x, this.elder.pos.z);
      const f = Math.floor(t * 2) % 2;
      items.push({ z: this.elder.pos.z, draw: () => g.drawImage(img("elder-npc"), f * 16, 0, 16, 24, nx - 8, ny - 22, 16, 24) });
    }
    for (const npc of [this.boss, hasArt("elder-npc") ? null : this.elder, this.ghostStone]) {
      if (!npc) continue;
      const [nx, ny] = toScreen(npc.pos.x, npc.pos.z);
      const s = npc.sprite;
      items.push({ z: npc.pos.z, draw: () => g.drawImage(s, nx - s.width / 2, ny - s.height + 2 - (Math.floor(t * 1.5) % 2)) });
    }
    const [qx, qy] = toScreen(this.pet.x, this.pet.z);
    const hop = Math.floor(t * 4) % 2;
    items.push({ z: this.pet.z, draw: () => g.drawImage(this.petSprite, qx - half, qy - OVERWORLD_MON + 2 - hop) });
    for (const w of this.wilds) {
      const [wx, wy] = toScreen(w.pos.x, w.pos.z);
      if (wx < -24 || wy < -24 || wx > sw + 24 || wy > sh + 24) continue;
      const wh = w.wait <= 0 ? Math.floor(t * 5 + w.id) % 2 : 0;
      items.push({ z: w.pos.z, draw: () => g.drawImage(w.sprite, wx - half, wy - OVERWORLD_MON + 2 - wh) });
    }
    for (const r of this.residents) {
      const [rx, ry] = toScreen(r.pos.x, r.pos.z);
      if (rx < -24 || ry < -40 || rx > sw + 24 || ry > sh + 24) continue;
      const sleeping = r.act.startsWith("z");
      items.push({
        z: r.pos.z,
        draw: () => {
          g.drawImage(r.sprite, rx - half, ry - OVERWORLD_MON + 2 + (sleeping ? 1 : 0));
          if (r.act && Math.floor(t * 1.5) % 3 !== 2) drawText(g, r.act, rx + 4, ry - OVERWORLD_MON - 8 - (Math.floor(t * 2) % 2), PAL.sandL);
        },
      });
    }
    items.sort((a, b) => a.z - b.z);
    for (const it of items) it.draw();

    for (const [who, b] of this.bubbles) {
      const pos = who === "pet" ? this.pet : who === "me" ? this.player : who.startsWith("p:") ? this.peers.get(who.slice(2))?.pos : who === "elder" ? this.elder?.pos : who === "boss" ? this.boss?.pos : who.startsWith("r") ? this.residents[Number(who.slice(1))]?.pos : this.wilds.find((w) => `w${w.id}` === who)?.pos;
      if (!pos) continue;
      const [bx, by] = toScreen(pos.x, pos.z);
      bubble(g, b.text, bx, by - OVERWORLD_MON - 4, sw);
    }
    const bed = this.bedNear();
    const hint = this.atDoor() ? "E: GO IN" : bed >= 0 && this.farm ? bedHint(this.farm, bed) : "";
    if (hint) {
      const w = hint.length * GLYPH + 12;
      drawFrame(g, Math.round(px - w / 2), py - 44, w, 16);
      drawText(g, hint, Math.round(px - w / 2) + 6, py - 40, PAL.wood);
    }
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

// A speech bubble above a sprite: up to 3 wrapped lines, kept on screen, with a small tail.
function bubble(g: CanvasRenderingContext2D, text: string, cx: number, bottom: number, sw: number): void {
  const lines = wrap(text, 132).slice(0, 3);
  const w = Math.max(...lines.map((l) => l.length)) * GLYPH + 12;
  const h = lines.length * 10 + 8;
  const x = Math.max(2, Math.min(sw - w - 2, Math.round(cx - w / 2)));
  const y = Math.max(2, bottom - h);
  drawFrame(g, x, y, w, h);
  g.fillStyle = PAL.panel;
  g.fillRect(cx - 2, y + h - 1, 4, 2);
  g.fillStyle = PAL.wood;
  g.fillRect(cx - 1, y + h + 1, 2, 2);
  lines.forEach((l, i) => drawText(g, l, x + 6, y + 5 + i * 10));
}

interface Peer {
  name: string;
  pos: Vec;
  pet: Vec;
  to: { x: number; z: number; px: number; pz: number };
  sprite: HTMLCanvasElement;
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
