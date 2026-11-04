import { describe, expect, it } from "vitest";
import { petLook } from "./genes";
import { Album, ALBUM_KEY, ALBUM_MAX, fetchPostcard, petAsk, type PostcardAsk } from "./postcard-api";

const GENES = { hue: 0.3, accent: 0.4, size: 0.5, ears: 3, tail: 2, horns: 2, pattern: 3 } as never;
const ASK: PostcardAsk = { scene: "win", player: "Kai", pet: petAsk("Bolt", GENES), foe: { arch: "brute" }, with: ["ama"] };
const IMG = "data:image/webp;base64,UklGR";
const memStore = () => {
  const m = new Map<string, string>();
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("postcards", () => {
  it("the pet's genes go as the game's own words and hues (what the sprite draws)", () => {
    const l = petLook(GENES);
    expect(ASK.pet).toEqual({ name: "Bolt", hue: l.hue, accent: l.accentHue, ears: l.ears, tail: l.tail, horns: l.horns, pattern: l.pattern });
    expect(petAsk("Rex", GENES, "brute").arch).toBe("brute");
  });

  it("a moment brings one card a kind a game day, kept in the album with its caption", async () => {
    const store = memStore();
    const asked: PostcardAsk[] = [];
    const album = new Album(store, true, async (a) => (asked.push(a), IMG), async (i) => i);
    const got: string[] = [];
    expect(album.maybe(ASK, "Bolt beat a wild Brute, Ama cheering", 5, (c) => got.push(c.caption))).toBe(true);
    await flush();
    expect(got).toEqual(["Bolt beat a wild Brute, Ama cheering"]);
    expect(album.maybe(ASK, "again", 5)).toBe(false); // one win card today
    expect(album.maybe({ ...ASK, scene: "campfire" }, "Elder's campfire story", 5)).toBe(true); // another kind
    await flush();
    expect(album.maybe(ASK, "next day", 6)).toBe(true);
    await flush();
    expect(album.cards.map((c) => c.caption)).toEqual(["Bolt beat a wild Brute, Ama cheering", "Elder's campfire story", "next day"]);
    expect(new Album(store, true).cards).toHaveLength(3); // kept on this device
    expect(JSON.parse(store.m.get(ALBUM_KEY)!).last).toEqual({ win: 6, campfire: 5 });
  });

  it("cloud off asks nothing; a failed painting leaves no card; the album keeps the last 12", async () => {
    let calls = 0;
    expect(new Album(memStore(), false, async () => (calls++, IMG)).maybe(ASK, "x", 1)).toBe(false);
    expect(calls).toBe(0);
    const none = new Album(memStore(), true, async () => null);
    none.maybe(ASK, "x", 1);
    await flush();
    expect(none.cards).toHaveLength(0);
    expect(none.maybe(ASK, "x", 1)).toBe(true); // no card came: the next win today may try again
    const full = new Album(memStore(), true, async () => IMG, async (i) => i);
    for (let d = 0; d < ALBUM_MAX + 3; d++) {
      full.maybe(ASK, `day ${d}`, d);
      await flush();
    }
    expect(full.cards).toHaveLength(ALBUM_MAX);
    expect(full.cards[0]!.caption).toBe("day 3");
  });

  it("storage full: the oldest cards go until the album fits", async () => {
    const store = memStore();
    const set = store.setItem;
    store.setItem = (k, v) => {
      if (v.length > 400) throw new Error("quota");
      set(k, v);
    };
    const album = new Album(store, true, async () => `${IMG}${"A".repeat(120)}`, async (i) => i);
    for (let d = 0; d < 4; d++) {
      album.maybe(ASK, `day ${d}`, d);
      await flush();
    }
    expect(album.cards.length).toBeLessThan(4);
    expect(album.cards.at(-1)!.caption).toBe("day 3");
  });

  it("fetch: an image data URL, else null", async () => {
    const reply = (body: unknown) => (async () => ({ ok: true, json: async () => body })) as unknown as typeof fetch;
    expect(await fetchPostcard(ASK, reply({ image: IMG }))).toBe(IMG);
    expect(await fetchPostcard(ASK, reply({ source: "none", why: "job_cap" }))).toBeNull();
    expect(await fetchPostcard(ASK, reply({ image: "javascript:alert(1)" }))).toBeNull();
    let n = 0;
    const busyOnce = (async () => ({ ok: true, json: async () => (n++ ? { image: IMG } : { source: "none", why: "rate_limit" }) })) as unknown as typeof fetch;
    expect(await fetchPostcard(ASK, busyOnce, 1000, 1)).toBe(IMG); // the per-minute limit: one more try
    expect(n).toBe(2);
    expect(await fetchPostcard(ASK, (async () => { throw new Error("offline"); }) as unknown as typeof fetch)).toBeNull();
  });
});
