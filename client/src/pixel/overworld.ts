// The top-down overworld scene: tile map, trees, the player and the following pet, a pixel-snapped follow
// camera and the place banner. Game rules (movement, the map) come from ../world; this file only decides
// what is where on screen.

import { generateWorld, platformAt, type WorldMap } from "../world/layout";
import { followStep, keyDir, slide, stepToward, WALK_SPEED, type Vec } from "../world/movement";
import { petLook, randomGenes } from "../game/genes";
import type { Genes } from "../sim/ghost";
import { ARCHETYPES, type ArchetypeId } from "../sim/types";
import { drawShore, makeAtlas, makePlayer, makeTree, PAL, type Atlas, type Sprite } from "./art";
import { BUILDS, drawMonster } from "./monster";
import { drawFrame, drawText, GLYPH } from "./text";
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
  private readonly atlas: Atlas;
  private readonly playerSprite: Sprite;
  private petSprite: HTMLCanvasElement;
  readonly wilds: Wild[] = [];
  private nextId = 1;
  private readonly treeSprite: Sprite;
  cam: Vec = { x: 0, z: 0 };

  constructor(petGenes: Genes) {
    this.world = generateWorld();
    this.map = buildTileMap(this.world);
    this.placeTrees();
    const home = this.world.platforms.find((p) => p.kind === "home")!;
    this.player = { x: home.x + 0.5, z: home.z + 3.5 };
    this.pet = { x: home.x - 1, z: home.z + 4 };
    this.cam = { ...this.player };
    this.atlas = makeAtlas();
    this.playerSprite = makePlayer();
    this.petSprite = drawMonster(petLook(petGenes), OVERWORLD_MON, "front");
    for (const p of this.world.platforms) if (p.kind === "wild") for (let i = 0; i < WILD_PER_MEADOW; i++) this.spawnWild(p.x, p.z, p.r);
    this.treeSprite = makeTree();
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

  setPet(g: Genes): void {
    this.petSprite = drawMonster(petLook(g), OVERWORLD_MON, "front");
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

  readonly canWalk = (x: number, z: number): boolean => {
    if (!tileWalkable(this.map, x, z)) return false;
    const i = Math.floor(x - this.map.ox);
    const j = Math.floor(z - this.map.oz);
    return !this.treeTiles.has(j * this.map.w + i);
  };

  // Returns the wild monster the player just bumped into, if any.
  update(dt: number, keys: ReadonlySet<string>): Wild | null {
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
    return met;
  }

  draw(g: CanvasRenderingContext2D, sw: number, sh: number, t: number): void {
    const m = this.map;
    const camX = Math.round(this.cam.x * TILE - sw / 2);
    const camY = Math.round(this.cam.z * TILE - sh / 2);
    const toScreen = (x: number, z: number): [number, number] => [Math.round(x * TILE) - camX, Math.round(z * TILE) - camY];
    const frame = Math.floor(t * 3);
    g.fillStyle = PAL.water;
    g.fillRect(0, 0, sw, sh);
    const i0 = Math.floor(camX / TILE) - 1; // world tile coords (tileAt subtracts the map origin)
    const j0 = Math.floor(camY / TILE) - 1;
    for (let j = j0; j <= j0 + Math.ceil(sh / TILE) + 2; j++) {
      for (let i = i0; i <= i0 + Math.ceil(sw / TILE) + 2; i++) {
        const k = tileAt(m, i + 0.5, j + 0.5);
        const [sx, sy] = toScreen(i, j);
        const [ax, ay] = this.atlas.at(k, Math.floor(hash2(i, j, 4) * 3), frame + i + j);
        g.drawImage(this.atlas.img, ax, ay, TILE, TILE, sx, sy, TILE, TILE);
        if (k !== T.water && k !== T.bridge) {
          if (tileAt(m, i + 0.5, j + 1.5) === T.water) drawShore(g, sx, sy, "s", frame);
          if (tileAt(m, i + 0.5, j - 0.5) === T.water) drawShore(g, sx, sy, "n", frame);
          if (tileAt(m, i + 1.5, j + 0.5) === T.water) drawShore(g, sx, sy, "e", frame);
          if (tileAt(m, i - 0.5, j + 0.5) === T.water) drawShore(g, sx, sy, "w", frame);
        }
      }
    }
    // Sprites sorted by their feet, so things lower on screen stand in front.
    const items: { z: number; draw: () => void }[] = [];
    for (const tr of this.trees) {
      const [sx, sy] = toScreen(tr.x, tr.z);
      if (sx < -32 || sy < -48 || sx > sw + 32 || sy > sh + 48) continue;
      items.push({ z: tr.z, draw: () => g.drawImage(this.treeSprite.img, sx - 16, sy - 36) });
    }
    const [px, py] = toScreen(this.player.x, this.player.z);
    const pf = this.moving ? Math.floor(this.walkT * 8) % 2 : 0;
    items.push({ z: this.player.z, draw: () => g.drawImage(this.playerSprite.img, pf * 16, this.dir * 24, 16, 24, px - 8, py - 22, 16, 24) });
    const half = OVERWORLD_MON / 2;
    const [qx, qy] = toScreen(this.pet.x, this.pet.z);
    const hop = Math.floor(t * 4) % 2;
    items.push({ z: this.pet.z, draw: () => g.drawImage(this.petSprite, qx - half, qy - OVERWORLD_MON + 2 - hop) });
    for (const w of this.wilds) {
      const [wx, wy] = toScreen(w.pos.x, w.pos.z);
      if (wx < -24 || wy < -24 || wx > sw + 24 || wy > sh + 24) continue;
      const wh = w.wait <= 0 ? Math.floor(t * 5 + w.id) % 2 : 0;
      items.push({ z: w.pos.z, draw: () => g.drawImage(w.sprite, wx - half, wy - OVERWORLD_MON + 2 - wh) });
    }
    items.sort((a, b) => a.z - b.z);
    for (const it of items) it.draw();

    if (this.bannerT > 0 && this.place) {
      const w = this.place.length * GLYPH + 16;
      const x = Math.floor((sw - w) / 2);
      const y = this.bannerT > 2.2 ? -16 + Math.round((2.5 - this.bannerT) * 70) : this.bannerT < 0.3 ? 5 - Math.round((0.3 - this.bannerT) * 70) : 5;
      drawFrame(g, x, y, w, 17);
      drawText(g, this.place, x + 8, y + 5, PAL.wood);
    }
  }
}
