// Inside your house: the pack's demo house with its roof lifted (scripts/art-interior.py). Walk around with your pets,
// add furniture (Tab: decorate) and use the shipping crate by the door (sell the harvest, buy seeds). The floor plan
// is in ../game/house.ts and the furniture rules in ../game/room.ts; this file draws and walks them.

import { HOUSE_DOOR, HOUSE_EXIT_Y, onFloor } from "../game/house";
import { CRATE, COLS, FURNITURE, PIECE_KINDS, ROWS, blocked, canPlace, pieceAt, place, removeAt, type Piece, type PieceKind } from "../game/room";
import { followStep, keyDir, slide, type Vec } from "../world/movement";
import { makePlayer, PAL, spriteFrame, type Sprite } from "./art";
import { HUMAN_RUN_SPEED, HUMAN_WALK_SPEED, humanSprites, newHumanMotion, stepHumanMotion, type HumanLook } from "./humans";
import { characterShadow, drawFaded, drawGrass, extendBand, stand } from "./sunny";
import { drawFrame, drawText, GLYPH } from "./text";

export const ROOM_W = 264;
export const ROOM_H = 178;
const C = 16; // cell size
const GX = 53 / C; // where the furniture grid starts on the picture, in cells
const GY = 28 / C;
const ROAD_Y = 128; // the road across the picture, carried on past its edges
const ROAD_H = 19;
const ROOF_FADE = 0.7; // seconds for the roof to lift as you come in
const DOOR_AT = { x: HOUSE_DOOR.x / C, z: HOUSE_DOOR.y / C };
const EXIT_Z = HOUSE_EXIT_Y / C;

export interface InteriorHost {
  room(): Piece[];
  setRoom(r: Piece[]): void;
  petSprite(): HTMLCanvasElement;
  residents(): HTMLCanvasElement[];
  look(): HumanLook;
  useCrate(): void; // opens the crate menu (main.ts owns coins and the farm)
  leave(): void;
}

type Ctx = CanvasRenderingContext2D;
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
  // Decorate mode: a cell cursor and the piece kind to place.
  deco: { x: number; y: number; kind: number } | null = null;
  private sitters: Vec[] = [{ x: 5, z: 3.9 }, { x: 6.6, z: 4.2 }, { x: 8.5, z: 3.4 }, { x: 10.2, z: 2.9 }, { x: 13, z: 3.1 }];

  constructor(private readonly host: InteriorHost) {}

  enter(): void {
    this.player = { ...DOOR_AT };
    this.pet = { ...DOOR_AT };
    this.entered = -1;
    this.dir = 3;
    this.deco = null;
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
    const d = this.deco;
    if (d) {
      const kinds = PIECE_KINDS;
      if (k === "arrowleft" || k === "a") d.x = Math.max(0, d.x - 1);
      if (k === "arrowright" || k === "d") d.x = Math.min(COLS - 1, d.x + 1);
      if (k === "arrowup" || k === "w") d.y = Math.max(0, d.y - 1);
      if (k === "arrowdown" || k === "s") d.y = Math.min(ROWS - 1, d.y + 1);
      if (k === "q" || k === "[") d.kind = (d.kind + kinds.length - 1) % kinds.length;
      if (k === "e" || k === "]") d.kind = (d.kind + 1) % kinds.length;
      if (k === "enter" || k === " " || k === "z") {
        const p = { kind: kinds[d.kind]!, x: d.x, y: d.y };
        const r = this.host.room();
        // Never trap the player: refuse a piece over where they stand.
        const [fx, fz] = [Math.floor(this.player.x - GX), Math.floor(this.player.z - GY)];
        const onPlayer = !FURNITURE[p.kind].rug && fx >= p.x && fx < p.x + FURNITURE[p.kind].w && fz >= p.y && fz < p.y + FURNITURE[p.kind].h;
        if (!onPlayer && cellsOnFloor(p) && canPlace(r, p)) this.host.setRoom(place(r, p));
      }
      if (k === "x" || k === "backspace" || k === "delete") this.host.setRoom(removeAt(this.host.room(), d.x, d.y));
      if (k === "escape" || k === "tab") this.deco = null;
      return;
    }
    if (k === "tab") {
      const f = this.facing();
      this.deco = { x: Math.max(0, Math.min(COLS - 1, f.x)), y: Math.max(0, Math.min(ROWS - 1, f.y)), kind: 0 };
    }
    if ((k === "e" || k === "enter") && this.nearCrate()) this.host.useCrate();
  }

  update(dt: number, keys: ReadonlySet<string>): void {
    if (this.deco) return;
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

  draw(g: Ctx, sw: number, sh: number, t: number): void {
    if (this.entered < 0) this.entered = t;
    const ox = sw >= ROOM_W ? Math.floor((sw - ROOM_W) / 2) : Math.round(Math.max(sw - ROOM_W, Math.min(0, sw / 2 - this.player.x * C)));
    const oy = sh >= ROOM_H ? Math.floor((sh - ROOM_H) / 2) : Math.round(Math.max(sh - ROOM_H, Math.min(0, sh / 2 - this.player.z * C)));
    drawGrass(g, sw, sh);
    extendBand(g, "interior", ox, oy, ROAD_Y, ROAD_H, sw);
    stand(g, "interior", ox + ROOM_W / 2, oy + ROOM_H);
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
    drawFaded(g, "interior-roof", ox, oy, 1 - (t - this.entered) / ROOF_FADE);

    if (this.deco) {
      const d = this.deco;
      const kind = PIECE_KINDS[d.kind]!;
      const f = FURNITURE[kind];
      const ok = cellsOnFloor({ kind, x: d.x, y: d.y }) && canPlace(room, { kind, x: d.x, y: d.y });
      const [cx, cy] = at(d.x, d.y);
      if (Math.floor(t * 4) % 2) {
        g.globalAlpha = 0.6;
        drawPiece(g, kind, cx, cy);
        g.globalAlpha = 1;
      }
      g.strokeStyle = ok ? PAL.panel : PAL.coral;
      g.strokeRect(cx + 0.5, cy + 0.5, f.w * C - 1, f.h * C - 1);
      const under = pieceAt(room, d.x, d.y);
      const line1 = `PLACE: ${f.label.toUpperCase()}  (Q/E)`;
      const line2 = `ENTER PUT  X ${under >= 0 ? "TAKE" : "-"}  ESC DONE`;
      const w = Math.max(line1.length, line2.length) * GLYPH + 16;
      drawFrame(g, Math.floor((sw - w) / 2), 6, w, 30);
      drawText(g, line1, Math.floor((sw - w) / 2) + 8, 12, PAL.wood);
      drawText(g, line2, Math.floor((sw - w) / 2) + 8, 22);
    } else {
      const hint = this.nearCrate() ? "E: CRATE" : "TAB: DECORATE";
      const w = hint.length * GLYPH + 12;
      drawFrame(g, sw - w - 6, 6, w, 16);
      drawText(g, hint, sw - w, 10, PAL.wood);
    }
  }
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
