// Logical-pixel roots from the batch 1/2 art manifests. Never resize these PNGs.
const ROOTS = {
  "market-stall": [24, 44],
  "notice-board-notes": [16, 31],
  "dance-floor-inactive": [0, 0],
  "dance-floor-active": [0, 0],
  "soccer-goal": [24, 30],
  "soccer-ball": [8, 13],
  "birthday-bunting": [16, 4],
  "birthday-balloon-red": [8, 23],
  "birthday-balloon-blue": [8, 23],
  "birthday-balloon-gold": [8, 23],
} as const;
export type GeneratedSprite = keyof typeof ROOTS;

export class GeneratedSprites {
  private readonly images = new Map<GeneratedSprite, { image: HTMLImageElement; ready: boolean }>();

  // First draw starts one request. Pending/failed files keep the previous drawing forever if necessary.
  draw(g: CanvasRenderingContext2D, name: GeneratedSprite, x: number, y: number, fallback: () => void = () => {}): void {
    let entry = this.images.get(name);
    if (!entry && typeof Image !== "undefined") {
      const image = new Image();
      const loading = { image, ready: false };
      this.images.set(name, loading);
      image.onload = () => { loading.ready = true; };
      image.onerror = () => { loading.ready = false; };
      image.src = `/art/gen/${name}.png`;
      entry = loading;
    }
    if (!entry?.ready) return fallback();
    const [rx, ry] = ROOTS[name];
    g.save();
    g.imageSmoothingEnabled = false;
    g.drawImage(entry.image, Math.round(x - rx), Math.round(y - ry));
    g.restore();
  }
}

export const generatedSprites = new GeneratedSprites();
