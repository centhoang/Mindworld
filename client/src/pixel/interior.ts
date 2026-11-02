// Inside your house: one wing of the pack's demo house with its roof lifted (scripts/art-home-wing.py). Walk around with your pets,
// and use the shipping crate by the door (sell the harvest, buy seeds). The floor plan
// is in ../game/house.ts and the furniture rules in ../game/room.ts; this file draws and walks them.

import { BUILT_IN_PIECES, HOME_FOOT, HOME_ROOF, HOUSE_DOOR, HOUSE_EXIT_Y, onFloor } from "../game/house";
import type { Scene, SceneProp } from "../game/ports";
import type { Genes } from "../sim/ghost";
import { T, type TileMap } from "../world/tilemap";
import { CRATE, COLS, FURNITURE, PIECE_KINDS, ROWS, blocked, canPlace, pieceAt, place, removeAt, type Piece, type PieceKind } from "../game/room";
import { followStep, keyDir, slide, type Vec } from "../world/movement";
import { makePlayer, PAL, spriteFrame, type Sprite } from "./art";
import { HUMAN_RUN_SPEED, HUMAN_WALK_SPEED, humanSprites, newHumanMotion, stepHumanMotion, type HumanLook } from "./humans";
import { characterShadow, drawFaded, stand } from "./sunny";
import { drawFrame, drawText, GLYPH } from "./text";

export const ROOM_W = 264;
export const ROOM_H = 178;
const C = 16; // cell size
const GX = 53 / C; // where the furniture grid starts on the picture, in cells
const GY = 28 / C;
const ROOF_FADE = 0.7; // seconds for the roof to lift as you come in
const DOOR_AT = { x: HOUSE_DOOR.x / C, z: HOUSE_DOOR.y / C };
const EXIT_Z = HOUSE_EXIT_Y / C;

type Ctx = CanvasRenderingContext2D;

export interface InteriorHost {
  room(): Piece[];
  petSprite(): HTMLCanvasElement;
  residents(): HTMLCanvasElement[];
  look(): HumanLook;
  genes(): Genes;
  residentGenes(): (Genes | null)[];
  useCrate(): void; // opens the crate menu (main.ts owns coins and the farm)
  leave(): void;
  around(g: Ctx, sw: number, sh: number, t: number, footX: number, footY: number): void; // the world outside
}

export class Interior {
  player: Vec = { ...DOOR_AT };
  pet: Vec = { ...DOOR_AT };
  private entered = -1; // the clock when you came in
  private dir = 3;
  private moving = false;
  private walkT = 0;
  private sprite: Sprite | null = null;
  private get playerSprite(): Sprite {
    return (this.sprite ??= makePlayer());
  }
  private readonly motion = newHumanMotion(this.player);
  private sitters: Vec[] = [{ x: 13, z: 5.2 }, { x: 14.5, z: 5.2 }, { x: 10.5, z: 5.2 }, { x: 9.5, z: 4.8 }, { x: 10.5, z: 3.2 }];

  constructor(private readonly host: InteriorHost) {}

  enter(): void {
    this.player = { ...DOOR_AT };
    this.pet = { ...DOOR_AT };
    this.entered = -1;
    this.dir = 3;
    this.motion.pos = { ...this.player };
    this.motion.dir = 3;
  }

  // Pieces saved for an older house may lie on walls now: those simply don't stand.
  private pieces(): Piece[] {
    return this.host.room().filter((p) => cellsOnFloor(p));
  }

  private readonly walk = (x: number, z: number): boolean => {
    if (!onFloor(x * C, z * C)) return false;
    const cx = x - GX;
    const cz = z - GY;
    const inGrid = cx >= 0 && cz >= 0 && cx < COLS && cz < ROWS;
    return !inGrid || !blocked(this.pieces(), cx, cz);
  };

  // What the player faces: the crate, a cell, or nothing.
  private facing(): { x: number; y: number } {
    const f = [[0, 0.8], [-0.8, 0], [0.8, 0], [0, -0.8]][this.dir]!;
    return { x: Math.floor(this.player.x - GX + f[0]!), y: Math.floor(this.player.z - GY + f[1]!) };
  }

  nearCrate(): boolean {
    const f = this.facing();
    return f.x === CRATE.x && f.y === CRATE.y;
  }

  key(k: string): void {
    if ((k === "e" || k === "enter") && this.nearCrate()) this.host.useCrate();
  }

  update(dt: number, keys: ReadonlySet<string>): void {
    const d = keyDir(keys);
    this.moving = d.x !== 0 || d.z !== 0;
    if (this.moving) {
      const speed = (keys.has("shift") ? HUMAN_RUN_SPEED : HUMAN_WALK_SPEED) * dt;
      this.player = slide(this.player, d.x * speed, d.z * speed, this.walk);
      this.dir = Math.abs(d.x) > Math.abs(d.z) ? (d.x < 0 ? 1 : 2) : d.z < 0 ? 3 : 0;
      this.walkT += dt;
    }
    this.pet = followStep(this.pet, this.player, dt, this.walk);
    stepHumanMotion(this.motion, this.player, dt);
    if (this.player.z > EXIT_Z) this.host.leave();
  }

  // The room as a scene for a view that reads scenes: the same plane as the village, on its own small map.
  scene(base: Scene): Scene {
    const props: SceneProp[] = BUILT_IN_PIECES.map((p) => ({ kind: p.kind, x: p.x / C, z: p.y / C }));
    for (const p of this.pieces()) {
      const f = FURNITURE[p.kind];
      props.push({ kind: p.kind, x: p.x + GX + f.w / 2, z: p.y + GY + f.h });
    }
    props.push({ kind: "crates", x: CRATE.x + GX + 0.5, z: CRATE.y + GY + 1 });
    const pets = this.host.residentGenes().slice(0, this.sitters.length).flatMap((genes, i) => {
      const pos = this.sitters[i]!;
      return this.walk(pos.x, pos.z) ? [{ id: `r${i}`, kind: "resident" as const, x: pos.x, z: pos.z, genes, pose: null }] : [];
    });
    pets.push({ id: "pet", kind: "resident" as const, x: this.pet.x, z: this.pet.z, genes: this.host.genes(), pose: null });
    return {
      ...base,
      map: roomMap(),
      cam: { x: ROOM_W / C / 2, z: ROOM_H / C / 2 - 1 },
      indoors: true,
      showMap: false,
      people: [{ id: "me", name: "", kind: "me", x: this.player.x, z: this.player.z, dir: this.dir as 0 | 1 | 2 | 3, walking: this.moving, pose: null, look: this.host.look() }],
      pets, props, beds: [], bubbles: [], banner: null, inspector: null,
      hint: this.nearCrate() ? "E: CRATE" : null,
      panels: base.panels,
    };
  }

  draw(g: Ctx, sw: number, sh: number, t: number): void {
    if (this.entered < 0) this.entered = t;
    // The same house on the same ground: the world stays where it was and only the roof comes off.
    const ox = Math.floor(sw / 2) - HOME_FOOT.x;
    const oy = Math.floor(sh / 2) - (HOME_FOOT.y - Math.floor(HOME_ROOF.h / 2));
    const [fx, fy] = [ox + HOME_FOOT.x, oy + HOME_FOOT.y];
    this.host.around(g, sw, sh, t, fx, fy);
    stand(g, "home-wing-open", fx, fy);
    const free = (x: number, z: number): [number, number] => [ox + Math.round(x * C), oy + Math.round(z * C)];
    const at = (x: number, z: number): [number, number] => free(x + GX, z + GY);
    const room = this.pieces();
    // Rugs first, then everything with feet, sorted by their bottom edge.
    for (const p of room) if (FURNITURE[p.kind].rug) drawPiece(g, p.kind, ...at(p.x, p.y));
    const items: { z: number; draw: () => void }[] = [];
    for (const p of room) if (!FURNITURE[p.kind].rug) items.push({ z: p.y + FURNITURE[p.kind].h - 0.01, draw: () => drawPiece(g, p.kind, ...at(p.x, p.y)) });
    items.push({ z: CRATE.y + 0.99, draw: () => drawCrate(g, ...at(CRATE.x, CRATE.y)) });
    const res = this.host.residents();
    res.slice(0, this.sitters.length).forEach((s, i) => {
      const pos = this.sitters[i]!;
      if (!this.walk(pos.x, pos.z)) return;
      const [x, y] = free(pos.x, pos.z);
      items.push({ z: pos.z, draw: () => g.drawImage(s, x - s.width / 2, y - s.height + 2 + (Math.floor(t * 1.2 + i) % 2)) });
    });
    const pet = this.host.petSprite();
    const [qx, qy] = free(this.pet.x, this.pet.z);
    items.push({ z: this.pet.z, draw: () => g.drawImage(pet, qx - pet.width / 2, qy - pet.height + 2 - (Math.floor(t * 4) % 2)) });
    const [px0, py0] = free(this.player.x, this.player.z);
    const pf = spriteFrame(this.playerSprite, this.moving, this.walkT, t);
    items.push({ z: this.player.z, draw: () => {
      characterShadow(g, px0, py0);
      humanSprites.draw(g, this.host.look(), this.motion, px0, py0, t, () => g.drawImage(this.playerSprite.img, pf * 16, this.dir * 24, 16, 24, px0 - 8, py0 - 22, 16, 24));
    } });
    items.sort((a, b) => a.z - b.z);
    for (const it of items) it.draw();
    drawFaded(g, "home-wing-roof", fx - Math.floor(HOME_ROOF.w / 2), fy - HOME_ROOF.h, 1 - (t - this.entered) / ROOF_FADE);

    if (this.nearCrate()) {
      const hint = "E: CRATE";
      const w = hint.length * GLYPH + 12;
      drawFrame(g, sw - w - 6, 6, w, 16);
      drawText(g, hint, sw - w, 10, PAL.wood);
    }
  }
}

let room: TileMap | null = null;
function roomMap(): TileMap {
  if (room) return room;
  const w = Math.ceil(ROOM_W / C), h = Math.ceil(ROOM_H / C) + 2;
  const kind = new Uint8Array(w * h).fill(T.grass);
  const floor = (i: number, j: number) => [2, 8, 14].some((a) => [2, 8, 14].some((b) => onFloor(i * C + a, j * C + b)));
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (floor(i, j)) kind[j * w + i] = T.floor;
  // Walls fill the building's box, so the rooms read as one house.
  const on = [...kind.keys()].filter((k) => kind[k] === T.floor);
  const [x0, x1] = [Math.min(...on.map((k) => k % w)) - 1, Math.max(...on.map((k) => k % w)) + 1];
  const [z0, z1] = [Math.floor(on[0]! / w) - 2, Math.floor(on[on.length - 1]! / w) - 1];
  for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) if (kind[j * w + i] !== T.floor) kind[j * w + i] = T.wall;
  return (room = { w, h, ox: 0, oz: 0, kind, look: new Uint8Array(w * h) });
}

function cellsOnFloor(p: Piece): boolean {
  const f = FURNITURE[p.kind];
  for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) if (!onFloor((p.x + i + GX + 0.5) * C, (p.y + j + GY + 0.5) * C)) return false;
  return true;
}

function drawCrate(g: Ctx, x: number, y: number): void {
  return stand(g, "crate", x + C / 2, y + C);
}

// The pack's furniture, standing on the bottom edge of its footprint.
const ART: Record<PieceKind, string> = { bed: "f-bed", rug: "f-rug", table: "f-table", chair: "f-stool", lamp: "f-vase", plant: "f-sunflower", shelf: "f-shelf", cushion: "spr_deco_rug_01" };

function drawPiece(g: Ctx, kind: PieceKind, x: number, y: number): void {
  stand(g, ART[kind], x + (FURNITURE[kind].w * C) / 2, y + FURNITURE[kind].h * C);
}
