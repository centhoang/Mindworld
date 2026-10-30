// Where speech bubbles go when several creatures talk at once. Bubbles never cover each other: each stays as close to
// its speaker as it can, speakers nearest the middle of the screen (the player) first, and one with no free spot waits
// for its turn. Pure, so the crowded cases can be tested.

export interface BubbleBox {
  cx: number; // the speaker on screen
  bottom: number; // the bubble's natural bottom edge, just above the speaker
  w: number;
  h: number;
}

export interface Placed {
  x: number;
  y: number;
  moved: boolean; // pushed away from its speaker: draw a leader line back to it
}

const GAP = 2;
const hit = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP;

export function layoutBubbles(boxes: readonly BubbleBox[], sw: number, sh: number): (Placed | null)[] {
  const out: (Placed | null)[] = new Array(boxes.length).fill(null);
  const taken: { x: number; y: number; w: number; h: number }[] = [];
  const far = (b: BubbleBox) => Math.abs(b.cx - sw / 2) + Math.abs(b.bottom - sh / 2);
  const order = boxes.map((_, i) => i).sort((a, b) => far(boxes[a]!) - far(boxes[b]!));
  for (const i of order) {
    const b = boxes[i]!;
    const x0 = Math.max(2, Math.min(sw - b.w - 2, Math.round(b.cx - b.w / 2)));
    const y0 = Math.max(2, b.bottom - b.h);
    let best: { x: number; y: number } | null = null;
    let score = Infinity;
    for (const dy of [0, -1, -2, -3, 1, 2, 3]) {
      for (const dx of [0, -1, 1, -2, 2]) {
        const x = Math.max(2, Math.min(sw - b.w - 2, x0 + dx * (b.w + GAP)));
        const y = Math.max(2, Math.min(sh - b.h - 2, y0 + dy * (b.h + GAP)));
        const cost = Math.abs(x - x0) + Math.abs(y - y0);
        if (cost < score && !taken.some((t) => hit(t, { x, y, w: b.w, h: b.h }))) {
          best = { x, y };
          score = cost;
        }
      }
    }
    if (!best) continue;
    taken.push({ ...best, w: b.w, h: b.h });
    out[i] = { ...best, moved: best.y !== y0 || best.x !== x0 };
  }
  return out;
}
