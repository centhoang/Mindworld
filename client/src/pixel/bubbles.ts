// Where speech bubbles go when several creatures talk at once. A bubble stays right above its speaker, stacked over
// its neighbours at most; a few of the speakers nearest the middle of the screen (the player) show their lines, and
// the rest wait with a small chat mark, so a crowd stays readable. Pure, so the crowded cases can be tested.

export interface BubbleBox {
  cx: number; // the speaker on screen
  bottom: number; // the bubble's natural bottom edge, just above the speaker
  w: number;
  h: number;
  first?: boolean; // speaks to me, or is me: always before the others
}

export interface Placed {
  x: number;
  y: number;
  moved: boolean; // not directly over its speaker: no tail
}

const GAP = 2;
export const MAX_BUBBLES = 3;
const hit = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP;

export function layoutBubbles(boxes: readonly BubbleBox[], sw: number, sh: number): (Placed | null)[] {
  const out: (Placed | null)[] = new Array(boxes.length).fill(null);
  const taken: { x: number; y: number; w: number; h: number }[] = [];
  const far = (b: BubbleBox) => (b.first ? -1e6 : 0) + Math.abs(b.cx - sw / 2) + Math.abs(b.bottom - sh / 2);
  const order = boxes.map((_, i) => i).sort((a, b) => far(boxes[a]!) - far(boxes[b]!));
  for (const i of order) {
    if (taken.length >= MAX_BUBBLES) break;
    const b = boxes[i]!;
    const x0 = Math.max(2, Math.min(sw - b.w - 2, Math.round(b.cx - b.w / 2)));
    const y0 = Math.max(2, b.bottom - b.h);
    let best: { x: number; y: number } | null = null;
    let score = Infinity;
    // Up the stack first; sideways only as far as the bubble still covers its speaker.
    for (const dy of [0, -1, -2, -3]) {
      for (const dx of [0, -0.4, 0.4]) {
        const x = Math.max(2, Math.min(sw - b.w - 2, Math.round(x0 + dx * b.w)));
        const y = Math.max(2, y0 + dy * (b.h + GAP));
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
