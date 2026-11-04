// Postcards (P5e): after a win, a new friend, or a campfire story with the villagers, Muse Image (Meta Model API, via
// worker /api/postcard) paints a keepsake postcard of your pet and who was there, from real state: the pet's genes,
// the villager who cheered or told the story, what happened. Kept in an album on this device (C opens it), the last
// 12. One postcard per kind of moment per game day; cloud off or failing = no card that time (the game is the same).
import type { ArchetypeId } from "../sim/types";
import type { Genes } from "../sim/ghost";
import type { Npc } from "../world/live";
import { petLook } from "./genes";
import { CLOUD_LIVELY } from "./test-mode";

export type PostcardScene = "win" | "friends" | "campfire";
export interface PetAsk {
  name: string;
  hue: number;
  accent: number;
  ears: string;
  tail: string;
  horns: string;
  pattern: string;
  arch?: ArchetypeId;
}
export interface PostcardAsk {
  scene: PostcardScene;
  player: string;
  pet: PetAsk;
  foe?: { arch?: ArchetypeId; owner?: string };
  friend?: PetAsk;
  with: Npc[];
}
export interface Card {
  t: number; // ms
  day: number; // game day
  scene: PostcardScene;
  caption: string;
  img: string; // data URL, shrunk
}

export const ALBUM_KEY = "petmind.album.v1";
export const ALBUM_MAX = 12;
const WAIT_MS = 100_000;
const RETRY_MS = 20_000;
const CARD_W = 480; // stored size: a 480x320 webp is ~30-60 KB

export function petAsk(name: string, genes: Genes, arch?: ArchetypeId): PetAsk {
  const l = petLook(genes);
  return { name, hue: l.hue, accent: l.accentHue, ears: l.ears, tail: l.tail, horns: l.horns, pattern: l.pattern, ...(arch ? { arch } : {}) };
}

// The painted image, or null. Busy (the worker's per-minute limit: a campfire story's talk call comes just before)
// = one more try after `retryMs`.
export async function fetchPostcard(ask: PostcardAsk, fetchFn: typeof fetch = (i, o) => fetch(i, o), waitMs = WAIT_MS, retryMs = RETRY_MS): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), waitMs);
    try {
      const res = await fetchFn("/api/postcard", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(ask), signal: ctl.signal });
      if (!res.ok) return null;
      const b = (await res.json()) as { image?: unknown; why?: unknown };
      if (typeof b.image === "string" && /^data:image\/(webp|png|jpeg);base64,/.test(b.image)) return b.image;
      if (b.why !== "rate_limit") return null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((r) => setTimeout(r, retryMs));
  }
  return null;
}

// The painted card, shrunk for the album (the browser only; elsewhere it stays as it came).
export async function shrink(dataUrl: string, w = CARD_W): Promise<string> {
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") return dataUrl;
  try {
    const bmp = await createImageBitmap(await (await fetch(dataUrl)).blob());
    const c = document.createElement("canvas");
    c.width = w;
    c.height = Math.round((bmp.height / bmp.width) * w);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const out = c.toDataURL("image/webp", 0.85);
    return out.startsWith("data:image/webp") ? out : c.toDataURL("image/jpeg", 0.85);
  } catch {
    return dataUrl;
  }
}

export interface AlbumStore {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}
interface AlbumSave {
  cards: Card[];
  last: Partial<Record<PostcardScene, number>>; // game day of the last card of each kind
}

export class Album {
  private data: AlbumSave = { cards: [], last: {} };
  private busy = false;

  constructor(
    private readonly store: AlbumStore | null = typeof localStorage === "undefined" ? null : localStorage,
    private readonly cloud = CLOUD_LIVELY,
    private readonly paint: (ask: PostcardAsk) => Promise<string | null> = (a) => fetchPostcard(a),
    private readonly fit: (img: string) => Promise<string> = (img) => shrink(img),
  ) {
    try {
      const raw = JSON.parse(this.store?.getItem(ALBUM_KEY) ?? "null") as Partial<AlbumSave> | null;
      if (raw && Array.isArray(raw.cards)) this.data = { cards: raw.cards.filter((c) => typeof c?.img === "string").slice(-ALBUM_MAX), last: raw.last ?? {} };
    } catch {
      /* a broken album starts empty */
    }
  }

  get cards(): readonly Card[] {
    return this.data.cards;
  }

  // A moment worth a postcard. False = not asked (cloud off, one of this kind today already, or one on its way).
  maybe(ask: PostcardAsk, caption: string, day: number, onCard?: (c: Card) => void): boolean {
    if (!this.cloud || this.busy || (this.data.last[ask.scene] ?? -1) >= day) return false;
    this.busy = true;
    const before = this.data.last[ask.scene];
    this.data.last = { ...this.data.last, [ask.scene]: day };
    this.save();
    void this.paint(ask)
      .then(async (img) => {
        if (!img) {
          // No card came: the next moment of this kind today may try again.
          this.data.last = { ...this.data.last, [ask.scene]: before ?? -1 };
          return this.save();
        }
        const card: Card = { t: Date.now(), day, scene: ask.scene, caption: caption.slice(0, 60), img: await this.fit(img) };
        this.data.cards = [...this.data.cards, card].slice(-ALBUM_MAX);
        this.save();
        onCard?.(card);
      })
      .finally(() => (this.busy = false));
    return true;
  }

  private save(): void {
    // Full storage: drop the oldest cards until it fits.
    for (let keep = this.data.cards.length; keep >= 0; keep--) {
      try {
        this.store?.setItem(ALBUM_KEY, JSON.stringify({ ...this.data, cards: this.data.cards.slice(this.data.cards.length - keep) }));
        this.data.cards = this.data.cards.slice(this.data.cards.length - keep);
        return;
      } catch {
        /* try with one card fewer */
      }
    }
  }
}
