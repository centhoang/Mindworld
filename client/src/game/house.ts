// The floor plan of every player's small house (bug 46: public/art/sunny/home-small-open.png, drawn in P4 to match the
// pack's house-bluesmall), in its pixels: where feet can go. One room of planks, minus the built-in furniture, and the
// doorway in the middle of the front wall. Pure, so the plan can be checked without a canvas.

type Rect = readonly [number, number, number, number]; // x0, y0, x1, y1

// Bug 55 (play-test #1): Codex redrew the room with every piece whole and the window on the back wall (rows 4-15);
// the plan below is its measured floor plan (.scratch/home-room-result.md), the doorway unchanged.
const FLOORS: readonly Rect[] = [
  [4, 28, 76, 48], // wall to wall below the furniture: room left of the lane, the lane, the crate's square
  [23, 24, 57, 28], // in front of the shelf, up to the table
  [39, 16, 57, 24], // the lane's top, beside the shelf, up to the back wall
  [32, 48, 48, 58], // the doorway
];
const BUILT_IN: readonly Rect[] = [
  [4, 22, 23, 28], // bed
  [23, 18, 39, 24], // shelf
  [57, 22, 75, 28], // table
];

// The same built-ins, to draw on the cell plane (the mosaic look): foot centre, in picture pixels.
export const BUILT_IN_PIECES: readonly { kind: string; x: number; y: number }[] = [
  { kind: "bed", x: 13, y: 27 }, { kind: "shelf", x: 31, y: 23 }, { kind: "table", x: 66, y: 27 },
];

const inside = ([x0, y0, x1, y1]: Rect, x: number, y: number) => x >= x0 && x < x1 && y >= y0 && y < y1;

// The house is the same picture outside and in (home-small-<roof>.png and home-small-open.png, one outline): its foot
// (bottom centre) in picture pixels, and the door's offset from that foot in tiles. What blocks, in tiles from the foot:
// x0, x1, z0, z1 (the back of the roof leans over open ground).
export const HOME_FOOT = { x: 40, y: 64 };
export const HOME_DOOR_DX = 0;
export const HOME_ROOF = { w: 80, h: 64 };
export const HOME_BLOCKS: readonly (readonly [number, number, number, number])[] = [[-2.5, 2.5, -2.6, 0.2]];
export const HOME_CHIMNEY: [number, number] = [63, 8]; // the chimney's mouth, from the picture's top left
export const HOUSE_DOOR = { x: 40, y: 46 }; // where you stand on coming in
export const HOUSE_EXIT_Y = 54; // past this, in the doorway, you are outside

export const onFloor = (x: number, y: number): boolean => FLOORS.some((r) => inside(r, x, y)) && !BUILT_IN.some((r) => inside(r, x, y));
