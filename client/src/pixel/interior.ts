// Inside your A-frame: a 384x216 room (STYLE.md: cream walls, timber beams, warm wood floor, teal window
// glass, no new colors). Walk around with your pets, arrange furniture (D: decorate) and use the shipping
// crate by the door (sell the harvest, buy seeds). Room rules live in ../game/room.ts; this file draws and
// walks it. Background and furniture are ImageGen art (interior-empty.png, props-decor.png).

import { CRATE, COLS, DOOR, FURNITURE, PIECE_KINDS, ROWS, blocked, canPlace, pieceAt, place, removeAt, type Piece, type PieceKind } from "../game/room";
import { followStep, keyDir, slide, WALK_SPEED, type Vec } from "../world/movement";
import { drawSheetProp, hasArt, img, makePlayer, PAL, type PropName, type Sprite } from "./art";
import { drawFrame, drawText, GLYPH } from "./text";

export const ROOM_W = 384;
export const ROOM_H = 216;
const C = 16; // cell size
const FX = 96; // floor origin inside the room picture
const FY = 104;

export interface InteriorHost {
  room(): Piece[];
  setRoom(r: Piece[]): void;
  petSprite(): HTMLCanvasElement;
  residents(): HTMLCanvasElement[];
  useCrate(): void; // opens the crate menu (main.ts owns coins and the farm)
  leave(): void;
}

type Ctx = CanvasRenderingContext2D;
const px = (g: Ctx, x: number, y: number, col: string, w = 1, h = 1) => {
  g.fillStyle = col;
  g.fillRect(Math.round(x), Math.round(y), w, h);
};

export class Interior {
  player: Vec = { x: DOOR.x + 1, z: ROWS - 0.6 };
  pet: Vec = { x: DOOR.x + 1, z: ROWS - 1.6 };
  private dir = 3;
  private moving = false;
  private walkT = 0;
  private sprite: Sprite | null = null;
  private get playerSprite(): Sprite {
    return (this.sprite ??= makePlayer());
  }
  private bg: HTMLCanvasElement | null = null;
  // Decorate mode: a cell cursor and the piece kind to place.
  deco: { x: number; y: number; kind: number } | null = null;
  private sitters: Vec[] = [{ x: 2.5, z: 3.6 }, { x: 6, z: 3 }, { x: 9.5, z: 3.5 }, { x: 1.5, z: 2.6 }, { x: 4.5, z: 2.4 }];

  constructor(private readonly host: InteriorHost) {}

  enter(): void {
    this.player = { x: DOOR.x + 1, z: ROWS - 0.6 };
    this.pet = { x: DOOR.x + 1, z: ROWS - 0.2 };
    this.dir = 3;
    this.deco = null;
  }

  private readonly walk = (x: number, z: number): boolean => {
    // The door gap lets you step out through the bottom wall.
    if (z >= ROWS && x > DOOR.x + 0.3 && x < DOOR.x + 1.7) return true;
    return !blocked(this.host.room(), x, z);
  };

  // What the player faces: the crate, a cell, or nothing.
  private facing(): { x: number; y: number } {
    const f = [[0, 0.8], [-0.8, 0], [0.8, 0], [0, -0.8]][this.dir]!;
    return { x: Math.floor(this.player.x + f[0]!), y: Math.floor(this.player.z + f[1]!) };
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
        const onPlayer = !FURNITURE[p.kind].rug && Math.floor(this.player.x) >= p.x && Math.floor(this.player.x) < p.x + FURNITURE[p.kind].w && Math.floor(this.player.z) >= p.y && Math.floor(this.player.z) < p.y + FURNITURE[p.kind].h;
        if (!onPlayer && canPlace(r, p)) this.host.setRoom(place(r, p));
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
      this.player = slide(this.player, d.x * WALK_SPEED * 0.8 * dt, d.z * WALK_SPEED * 0.8 * dt, this.walk);
      this.dir = Math.abs(d.x) > Math.abs(d.z) ? (d.x < 0 ? 1 : 2) : d.z < 0 ? 3 : 0;
      this.walkT += dt;
    }
    this.pet = followStep(this.pet, this.player, dt, (x, z) => !blocked(this.host.room(), x, z) || z >= ROWS);
    if (this.player.z > ROWS + 0.2) this.host.leave();
  }

  draw(g: Ctx, sw: number, sh: number, t: number): void {
    const ox = sw >= ROOM_W ? Math.floor((sw - ROOM_W) / 2) : Math.round(Math.max(sw - ROOM_W, Math.min(0, sw / 2 - (FX + this.player.x * C))));
    const oy = Math.floor((sh - ROOM_H) / 2);
    g.fillStyle = PAL.ink;
    g.fillRect(0, 0, sw, sh);
    g.drawImage(hasArt("interior-empty") ? img("interior-empty") : (this.bg ??= drawRoom()), ox, oy);
    const at = (x: number, z: number): [number, number] => [ox + FX + Math.round(x * C), oy + FY + Math.round(z * C)];
    const room = this.host.room();
    // Rugs first, then everything with feet, sorted by their bottom edge.
    for (const p of room) if (FURNITURE[p.kind].rug) drawPiece(g, p.kind, ...at(p.x, p.y));
    const items: { z: number; draw: () => void }[] = [];
    for (const p of room) if (!FURNITURE[p.kind].rug) items.push({ z: p.y + FURNITURE[p.kind].h - 0.01, draw: () => drawPiece(g, p.kind, ...at(p.x, p.y)) });
    items.push({ z: CRATE.y + 0.99, draw: () => drawCrate(g, ...at(CRATE.x, CRATE.y)) });
    const res = this.host.residents();
    res.slice(0, this.sitters.length).forEach((s, i) => {
      const pos = this.sitters[i]!;
      if (blocked(room, pos.x, pos.z)) return;
      const [x, y] = at(pos.x, pos.z);
      items.push({ z: pos.z, draw: () => g.drawImage(s, x - s.width / 2, y - s.height + 2 + (Math.floor(t * 1.2 + i) % 2)) });
    });
    const pet = this.host.petSprite();
    const [qx, qy] = at(this.pet.x, this.pet.z);
    items.push({ z: this.pet.z, draw: () => g.drawImage(pet, qx - pet.width / 2, qy - pet.height + 2 - (Math.floor(t * 4) % 2)) });
    const [px0, py0] = at(this.player.x, this.player.z);
    const pf = this.moving ? Math.floor(this.walkT * 8) % this.playerSprite.frames : 0;
    items.push({ z: this.player.z, draw: () => g.drawImage(this.playerSprite.img, pf * 16, this.dir * 24, 16, 24, px0 - 8, py0 - 22, 16, 24) });
    items.sort((a, b) => a.z - b.z);
    for (const it of items) it.draw();

    if (this.deco) {
      const d = this.deco;
      const kind = PIECE_KINDS[d.kind]!;
      const f = FURNITURE[kind];
      const ok = canPlace(room, { kind, x: d.x, y: d.y });
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

// Fallback room picture (tests, art not loaded); the ImageGen cabin shares its floor rect and door. Slanted timber roof meeting at the top, cream walls, a big triangular window
// and a plank floor. Drawn once.
function drawRoom(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = ROOM_W;
  c.height = ROOM_H;
  const g = c.getContext("2d")!;
  const mid = ROOM_W / 2;
  // Outside the roof line: dark timber.
  px(g, 0, 0, PAL.woodD, ROOM_W, ROOM_H);
  // Cream wall inside the A: rows narrowing to the apex.
  for (let y = 0; y < FY; y++) {
    const half = 40 + (y / FY) * 120;
    px(g, mid - half, y, PAL.cream, half * 2, 1);
    px(g, mid - half, y, PAL.wood, 6, 1); // rafters along both slopes
    px(g, mid + half - 6, y, PAL.wood, 6, 1);
    px(g, mid - half + 6, y, PAL.woodM, 2, 1);
  }
  // Collar beam and two posts.
  px(g, mid - 100, 30, PAL.woodD, 200, 6);
  px(g, mid - 100, 30, PAL.woodM, 200, 2);
  // Triangular window with teal glass and a cream cross.
  for (let y = 40; y < 96; y++) {
    const half = (y - 40) * 0.75;
    px(g, mid - half - 2, y, PAL.woodD, half * 2 + 4, 1);
    if (y < 94) px(g, mid - half, y, y < 70 ? PAL.waterL : PAL.foam, half * 2, 1);
  }
  px(g, mid - 1, 44, PAL.cream, 2, 50);
  px(g, mid - 22, 76, PAL.cream, 44, 2);
  // Skirting board.
  px(g, FX - 16, FY - 6, PAL.woodM, COLS * C + 32, 6);
  px(g, FX - 16, FY - 1, PAL.woodD, COLS * C + 32, 1);
  // Plank floor: rows of honey wood, seams every 8 px, staggered joints.
  for (let y = 0; y < ROWS * C; y++) {
    const row = Math.floor(y / 8);
    px(g, FX - 16, FY + y, y % 8 === 7 ? PAL.woodM : row % 2 ? PAL.woodL : PAL.sand, COLS * C + 32, 1);
    if (y % 8 !== 7) for (let x = (row % 3) * 13; x < COLS * C + 32; x += 40) px(g, FX - 16 + x, FY + y, PAL.woodM);
  }
  // Light from the window on the floor.
  for (let y = 0; y < 30; y++) {
    const half = 12 + y;
    for (let x = -half; x < half; x += 2) if ((x + y) % 4 === 0) px(g, mid + x, FY + 4 + y, PAL.furL);
  }
  // Door: a dark gap in the bottom wall, 2 cells wide.
  px(g, FX + DOOR.x * C, FY + ROWS * C, PAL.ink, 2 * C, ROOM_H - FY - ROWS * C);
  px(g, FX + DOOR.x * C + 4, FY + ROWS * C, PAL.grassS, 2 * C - 8, ROOM_H - FY - ROWS * C);
  return c;
}

function drawCrate(g: Ctx, x: number, y: number): void {
  return drawSheetProp(g, "crate", x, y + C);
}

export function drawCodedCrate(g: Ctx, x: number, y: number): void {
  px(g, x + 1, y + 2, PAL.ink, 14, 14);
  px(g, x + 2, y + 3, PAL.woodM, 12, 12);
  px(g, x + 2, y + 6, PAL.wood, 12, 1);
  px(g, x + 2, y + 10, PAL.wood, 12, 1);
  px(g, x + 2, y + 3, PAL.woodL, 12, 2);
  px(g, x + 5, y, PAL.grass, 3, 3); // a turnip leaf peeking out
  px(g, x + 9, y + 1, PAL.flowerP, 2, 2);
}

// ImageGen props for most furniture, bottom-aligned to the footprint so tall pieces rise above it.
const SHEET: Partial<Record<PieceKind, PropName>> = { bed: "bed", rug: "rug", table: "table", chair: "chair", lamp: "lamp", plant: "broadleaf", shelf: "bookshelf" };

function drawPiece(g: Ctx, kind: PieceKind, x: number, y: number): void {
  const prop = SHEET[kind];
  if (prop) return drawSheetProp(g, prop, x, y + FURNITURE[kind].h * C);
  drawCodedPiece(g, kind, x, y);
}

// Furniture in code (palette only): pieces with no sheet sprite yet.
function drawCodedPiece(g: Ctx, kind: PieceKind, x: number, y: number): void {
  switch (kind) {
    case "bed":
      px(g, x, y - 4, PAL.ink, 32, 36);
      px(g, x + 1, y - 3, PAL.wood, 30, 34);
      px(g, x + 3, y + 2, PAL.panel, 26, 7); // pillow
      px(g, x + 3, y + 10, PAL.grass, 26, 18); // blanket
      px(g, x + 3, y + 10, PAL.grassM, 26, 2);
      for (let i = 0; i < 4; i++) px(g, x + 6 + i * 6, y + 16 + (i % 2) * 5, PAL.grassL, 2, 2);
      break;
    case "rug":
      px(g, x + 1, y + 2, PAL.coral, 46, 28);
      px(g, x + 3, y + 4, PAL.flowerP, 42, 24);
      px(g, x + 6, y + 7, PAL.furL, 36, 18);
      px(g, x + 9, y + 10, PAL.flowerP, 30, 12);
      break;
    case "table":
      px(g, x + 1, y - 2, PAL.ink, 30, 12);
      px(g, x + 2, y - 1, PAL.woodL, 28, 6);
      px(g, x + 2, y + 5, PAL.wood, 28, 4);
      px(g, x + 3, y + 9, PAL.woodD, 2, 6);
      px(g, x + 27, y + 9, PAL.woodD, 2, 6);
      px(g, x + 12, y - 5, PAL.panel, 6, 4); // a teacup
      px(g, x + 13, y - 4, PAL.waterL, 4, 1);
      break;
    case "chair":
      px(g, x + 3, y - 6, PAL.woodD, 10, 20);
      px(g, x + 4, y - 5, PAL.woodM, 8, 8);
      px(g, x + 3, y + 4, PAL.wood, 10, 4);
      px(g, x + 4, y + 8, PAL.woodD, 2, 6);
      px(g, x + 10, y + 8, PAL.woodD, 2, 6);
      break;
    case "lamp":
      px(g, x + 7, y - 2, PAL.woodD, 2, 16);
      px(g, x + 4, y + 13, PAL.woodD, 8, 2);
      px(g, x + 3, y - 10, PAL.ink, 10, 9);
      px(g, x + 4, y - 9, PAL.flowerY, 8, 7);
      px(g, x + 5, y - 8, PAL.furL, 3, 2);
      break;
    case "plant":
      px(g, x + 4, y + 7, PAL.ink, 8, 8);
      px(g, x + 5, y + 8, PAL.coral, 6, 6);
      px(g, x + 5, y + 8, PAL.flowerP, 6, 2);
      for (const [dx, dy] of [[2, -6], [8, -9], [5, -3], [10, -2], [0, 0]] as const) {
        px(g, x + 2 + dx, y + 2 + dy, PAL.grassS, 4, 6);
        px(g, x + 3 + dx, y + 2 + dy, PAL.grass, 2, 4);
      }
      break;
    case "shelf":
      px(g, x, y - 16, PAL.ink, 32, 32);
      px(g, x + 1, y - 15, PAL.wood, 30, 30);
      for (let r = 0; r < 3; r++) {
        px(g, x + 2, y - 14 + r * 10, PAL.woodD, 28, 8);
        const cols = [PAL.coral, PAL.teal, PAL.flowerY, PAL.grassS, PAL.panel];
        for (let b = 0; b < 6; b++) px(g, x + 3 + b * 4 + (r % 2), y - 13 + r * 10 + (b % 2), cols[(b + r) % cols.length]!, 3, 7 - (b % 2));
      }
      break;
    case "cushion":
      px(g, x + 1, y + 4, PAL.furD, 14, 10);
      px(g, x + 2, y + 5, PAL.fur, 12, 7);
      px(g, x + 4, y + 6, PAL.furM, 8, 4);
      break;
  }
}
