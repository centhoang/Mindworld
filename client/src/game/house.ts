// The floor plan of every player's small house (bug 46: public/art/sunny/home-small-open.png, drawn in P4 to match the
// pack's house-bluesmall), in its pixels: where feet can go. One room of planks, minus the built-in furniture, and the
// doorway in the middle of the front wall. Pure, so the plan can be checked without a canvas.

type Rect = readonly [number, number, number, number]; // x0, y0, x1, y1

const FLOORS: readonly Rect[] = [
  [4, 26, 32, 48], // west of the lane, below the bed
  [23, 23, 32, 26], // beside the bed's foot
  [32, 23, 48, 48], // the lane from the door to the back wall
  [48, 32, 76, 48], // east: the crate's square and room in front of the table
  [62, 27, 76, 32], // beside the table
  [32, 48, 48, 58], // the doorway
];
const BUILT_IN: readonly Rect[] = [
  [5, 21, 22, 26], // bed
  [25, 17, 39, 23], // shelf
  [57, 22, 73, 27], // table
  [49, 29, 61, 32], // stool
];

// The same built-ins, to draw on the cell plane (the mosaic look): foot centre, in picture pixels.
export const BUILT_IN_PIECES: readonly { kind: string; x: number; y: number }[] = [
  { kind: "bed", x: 13, y: 26 }, { kind: "shelf", x: 32, y: 23 }, { kind: "table", x: 65, y: 27 }, { kind: "chair", x: 55, y: 32 },
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
