// Inside your house: a 384x216 room built from the pack's interior tiles. Walk around with your pets, arrange
// furniture (Tab: decorate) and use the shipping crate by the door (sell the harvest, buy seeds). Room rules
// live in ../game/room.ts; this file draws and walks it.

import { CRATE, COLS, DOOR, FURNITURE, PIECE_KINDS, ROWS, blocked, canPlace, pieceAt, place, removeAt, type Piece, type PieceKind } from "../game/room";
import { followStep, keyDir, slide, type Vec } from "../world/movement";
import { makePlayer, PAL, spriteFrame, type Sprite } from "./art";
import { HUMAN_RUN_SPEED, HUMAN_WALK_SPEED, humanSprites, newHumanMotion, stepHumanMotion, type HumanLook } from "./humans";
import { characterShadow, stand } from "./sunny";
import { drawFrame, drawText, GLYPH } from "./text";

export const ROOM_W = 384;
export const ROOM_H = 216;
const C = 16; // cell size
const FX = 96; // floor origin inside the room picture
const FY = 96;

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
  player: Vec = { x: DOOR.x + 1, z: ROWS - 0.6 };
  pet: Vec = { x: DOOR.x + 1, z: ROWS - 1.6 };
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
  private sitters: Vec[] = [{ x: 2.5, z: 3.6 }, { x: 6, z: 3 }, { x: 9.5, z: 3.5 }, { x: 1.5, z: 2.6 }, { x: 4.5, z: 2.4 }];

  constructor(private readonly host: InteriorHost) {}

  enter(): void {
    this.player = { x: DOOR.x + 1, z: ROWS - 0.6 };
    this.pet = { x: DOOR.x + 1, z: ROWS - 0.2 };
    this.dir = 3;
    this.deco = null;
    this.motion.pos = { ...this.player };
    this.motion.dir = 3;
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
      const speed = (keys.has("shift") ? HUMAN_RUN_SPEED : HUMAN_WALK_SPEED) * dt;
      this.player = slide(this.player, d.x * speed, d.z * speed, this.walk);
      this.dir = Math.abs(d.x) > Math.abs(d.z) ? (d.x < 0 ? 1 : 2) : d.z < 0 ? 3 : 0;
      this.walkT += dt;
    }
    this.pet = followStep(this.pet, this.player, dt, (x, z) => !blocked(this.host.room(), x, z) || z >= ROWS);
    stepHumanMotion(this.motion, this.player, dt);
    if (this.player.z > ROWS + 0.2) this.host.leave();
  }

  draw(g: Ctx, sw: number, sh: number, t: number): void {
    const ox = sw >= ROOM_W ? Math.floor((sw - ROOM_W) / 2) : Math.round(Math.max(sw - ROOM_W, Math.min(0, sw / 2 - (FX + this.player.x * C))));
    const oy = Math.floor((sh - ROOM_H) / 2);
    g.fillStyle = PAL.ink;
    g.fillRect(0, 0, sw, sh);
    stand(g, "interior", ox + ROOM_W / 2, oy + ROOM_H);
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
    const pf = spriteFrame(this.playerSprite, this.moving, this.walkT, t);
    items.push({ z: this.player.z, draw: () => {
      characterShadow(g, px0, py0);
      humanSprites.draw(g, this.host.look(), this.motion, px0, py0, t, () => g.drawImage(this.playerSprite.img, pf * 16, this.dir * 24, 16, 24, px0 - 8, py0 - 22, 16, 24));
    } });
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

function drawCrate(g: Ctx, x: number, y: number): void {
  return stand(g, "crate", x + C / 2, y + C);
}

// The pack's furniture, standing on the bottom edge of its footprint.
const ART: Record<PieceKind, string> = { bed: "f-bed", rug: "f-rug", table: "f-table", chair: "f-stool", lamp: "f-vase", plant: "f-sunflower", shelf: "f-shelf", cushion: "spr_deco_rug_01" };

function drawPiece(g: Ctx, kind: PieceKind, x: number, y: number): void {
  stand(g, ART[kind], x + (FURNITURE[kind].w * C) / 2, y + FURNITURE[kind].h * C);
}
