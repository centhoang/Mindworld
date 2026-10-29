// Inside the A-frame: a floor of COLS x ROWS cells where the player arranges furniture. Rugs lie under
// everything and can be walked on; other pieces block their cells. The door cell (bottom centre) and the
// shipping crate's cell always stay clear. Pure rules on plain data; the pixel scene draws and walks it.

export const COLS = 12;
export const ROWS = 6;
export const DOOR = { x: 5, y: ROWS - 1 }; // the cell inside the door (2 wide: x 5 and 6)
export const CRATE = { x: 10, y: ROWS - 1 }; // shipping crate: sell the harvest, buy seeds

export const FURNITURE = {
  bed: { w: 2, h: 2, rug: false, label: "Bed" },
  rug: { w: 3, h: 2, rug: true, label: "Rug" },
  table: { w: 2, h: 1, rug: false, label: "Table" },
  chair: { w: 1, h: 1, rug: false, label: "Chair" },
  lamp: { w: 1, h: 1, rug: false, label: "Lamp" },
  plant: { w: 1, h: 1, rug: false, label: "Plant" },
  shelf: { w: 1, h: 1, rug: false, label: "Bookshelf" },
  cushion: { w: 1, h: 1, rug: true, label: "Pet cushion" },
} as const;
export type PieceKind = keyof typeof FURNITURE;
export const PIECE_KINDS = Object.keys(FURNITURE) as PieceKind[];
export const MAX_PIECES = 24;

export interface Piece {
  kind: PieceKind;
  x: number; // top-left cell
  y: number;
}

const cells = (p: Piece): [number, number][] => {
  const f = FURNITURE[p.kind];
  const out: [number, number][] = [];
  for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) out.push([p.x + i, p.y + j]);
  return out;
};

const reserved = (x: number, y: number) => (y === DOOR.y && (x === DOOR.x || x === DOOR.x + 1)) || (x === CRATE.x && y === CRATE.y);

export const isKind = (v: unknown): v is PieceKind => typeof v === "string" && v in FURNITURE;

export function canPlace(list: readonly Piece[], p: Piece): boolean {
  if (!isKind(p.kind) || !Number.isInteger(p.x) || !Number.isInteger(p.y) || list.length >= MAX_PIECES) return false;
  const rug = FURNITURE[p.kind].rug;
  return cells(p).every(([x, y]) => {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
    if (!rug && reserved(x, y)) return false;
    // Same layer may not overlap; a rug may lie under furniture and vice versa.
    return !list.some((q) => FURNITURE[q.kind].rug === rug && cells(q).some(([a, b]) => a === x && b === y));
  });
}

export function place(list: readonly Piece[], p: Piece): Piece[] {
  return canPlace(list, p) ? [...list, { kind: p.kind, x: p.x, y: p.y }] : [...list];
}

// The top piece covering a cell (furniture before rugs), or -1.
export function pieceAt(list: readonly Piece[], x: number, y: number): number {
  let rug = -1;
  for (let i = list.length - 1; i >= 0; i--) {
    if (!cells(list[i]!).some(([a, b]) => a === x && b === y)) continue;
    if (!FURNITURE[list[i]!.kind].rug) return i;
    if (rug < 0) rug = i;
  }
  return rug;
}

export function removeAt(list: readonly Piece[], x: number, y: number): Piece[] {
  const i = pieceAt(list, x, y);
  return i < 0 ? [...list] : list.filter((_, j) => j !== i);
}

// Walls, furniture and the crate block walking; rugs and empty floor don't. x, y in cell units.
export function blocked(list: readonly Piece[], x: number, y: number): boolean {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return true;
  if (cx === CRATE.x && cy === CRATE.y) return true;
  return list.some((p) => !FURNITURE[p.kind].rug && cells(p).some(([a, b]) => a === cx && b === cy));
}

export const defaultRoom = (): Piece[] => [
  { kind: "rug", x: 4, y: 2 },
  { kind: "bed", x: 0, y: 0 },
  { kind: "table", x: 8, y: 1 },
  { kind: "chair", x: 8, y: 2 },
  { kind: "plant", x: 11, y: 0 },
  { kind: "shelf", x: 3, y: 0 },
  { kind: "cushion", x: 2, y: 3 },
  { kind: "lamp", x: 11, y: 3 },
];

// Saved data. Never throws; pieces that don't fit (in order) are dropped.
export function parseRoom(raw: unknown): Piece[] {
  if (!Array.isArray(raw)) return defaultRoom();
  let out: Piece[] = [];
  for (const r of raw.slice(0, MAX_PIECES)) {
    if (!r || typeof r !== "object") continue;
    const { kind, x, y } = r as Partial<Piece>;
    if (isKind(kind) && typeof x === "number" && typeof y === "number") out = place(out, { kind, x, y });
  }
  return out;
}
