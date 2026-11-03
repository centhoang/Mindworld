// The floor plan of the house picture (public/art/sunny/interior.png), in its pixels: where feet can go. Rooms joined by
// doorways, minus the built-in furniture. Pure, so the plan can be checked without a canvas.

type Rect = readonly [number, number, number, number]; // x0, y0, x1, y1

const FLOORS: readonly Rect[] = [
  [144, 40, 178, 61], // reading corner
  [160, 61, 178, 80], // hall, south end
  [145, 67, 164, 92], // through to the living room
  [145, 80, 257, 92], // living room, south side
  [198, 40, 257, 92], // living room
  [209, 92, 225, 100], // front door
];
const BUILT_IN: readonly Rect[] = [
  [180, 69, 196, 83], // drawers
  [204, 50, 251, 73], // dining table and chairs
];

// The same built-ins, to draw on the cell plane: foot centre, in picture pixels.
export const BUILT_IN_PIECES: readonly { kind: string; x: number; y: number }[] = [
  { kind: "bed", x: 57, y: 62 }, { kind: "bed", x: 58, y: 77 }, { kind: "table", x: 83, y: 50 }, { kind: "shelf", x: 188, y: 83 }, { kind: "table", x: 227, y: 73 },
];

const inside = ([x0, y0, x1, y1]: Rect, x: number, y: number) => x >= x0 && x < x1 && y >= y0 && y < y1;

// The house is the east wing of that picture (scripts/art-home-wing.py), the same outside and in: its foot (bottom
// centre of home-wing-roof.png) in picture pixels, and the door's offset from that foot in tiles. What blocks, in tiles
// from the foot: x0, x1, z0, z1.
export const HOME_FOOT = { x: 202, y: 113 };
export const HOME_DOOR_DX = 0;
export const HOME_ROOF = { w: 124, h: 136 };
export const HOME_BLOCKS: readonly (readonly [number, number, number, number])[] = [[-2.5, 2.5, -2.6, 0.2]];
export const HOME_CHIMNEY: [number, number] = [62, 8]; // PROVISIONAL until the art lands
export const HOUSE_DOOR = { x: 217, y: 90 }; // where you stand on coming in
export const HOUSE_EXIT_Y = 98; // past this you are outside

export const onFloor = (x: number, y: number): boolean => FLOORS.some((r) => inside(r, x, y)) && !BUILT_IN.some((r) => inside(r, x, y));
