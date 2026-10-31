// The floor plan of the house picture (public/art/sunny/interior.png), in its pixels: where feet can go. Rooms joined by
// doorways, minus the built-in furniture. Pure, so the plan can be checked without a canvas.

type Rect = readonly [number, number, number, number]; // x0, y0, x1, y1

const FLOORS: readonly Rect[] = [
  [49, 39, 92, 77], // bedroom
  [92, 50, 97, 66], // its doorway
  [97, 51, 114, 77], // hall, west end
  [114, 47, 178, 61], // hall
  [144, 40, 178, 61], // reading corner
  [160, 61, 178, 80], // hall, south end
  [145, 67, 164, 92], // through to the living room
  [145, 80, 257, 92], // living room, south side
  [198, 40, 257, 92], // living room
  [209, 92, 225, 100], // front door
];
const BUILT_IN: readonly Rect[] = [
  [49, 39, 65, 62], // bed
  [50, 68, 67, 77], // small bed
  [77, 39, 90, 50], // desk
  [180, 69, 196, 83], // drawers
  [204, 50, 251, 73], // dining table and chairs
];

const inside = ([x0, y0, x1, y1]: Rect, x: number, y: number) => x >= x0 && x < x1 && y >= y0 && y < y1;

export const HOUSE_DOOR = { x: 217, y: 90 }; // where you stand on coming in
export const HOUSE_EXIT_Y = 98; // past this you are outside

export const onFloor = (x: number, y: number): boolean => FLOORS.some((r) => inside(r, x, y)) && !BUILT_IN.some((r) => inside(r, x, y));
