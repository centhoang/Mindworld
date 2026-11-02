import { describe, expect, it } from "vitest";
import { LINES, nextChatter, pickLine, speakerFor, voiceFor } from "./chatter";
import { ownedItems, STARTER_SET } from "./decor";
import { addCoins, buy, coinsFor, MAX_COINS, parseCoins, parseOwned, PRICES, SHOP_ITEMS } from "./shop";

const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length]!;
};

describe("chatter", () => {
  it("picks lines from the speaker's pool and never repeats the last one", () => {
    for (const r of [0, 0.3, 0.99]) {
      const l = pickLine("elder", () => r, LINES.elder[0]);
      expect(LINES.elder).toContain(l);
      expect(l).not.toBe(LINES.elder[0]);
    }
    expect(LINES.pet).toContain(pickLine("pet", () => 0.9999));
  });

  it("maps world entities to speakers and keeps lines short", () => {
    expect(speakerFor("npc")).toBe("elder");
    expect(speakerFor("wild", "turtle")).toBe("turtle");
    expect(speakerFor("porch")).toBeNull();
    for (const pool of Object.values(LINES)) for (const l of pool) expect(l.length).toBeLessThanOrEqual(34);
    expect(voiceFor("elder").pitch).toBeLessThan(voiceFor("skitter").pitch);
  });

  it("spaces ambient chatter 6 to 11 seconds apart", () => {
    expect(nextChatter(seq(0))).toBe(6);
    expect(nextChatter(seq(0.999))).toBeLessThan(11);
  });
});

describe("coins and shop", () => {
  it("pays for wild wins and more for befriending", () => {
    expect(coinsFor("win")).toBe(3);
    expect(coinsFor("win", "befriended")).toBe(5);
    expect(coinsFor("loss")).toBe(0);
    expect(coinsFor("escaped")).toBe(0);
  });

  it("clamps coins", () => {
    expect(addCoins(5, -10)).toBe(0);
    expect(addCoins(MAX_COINS, 5)).toBe(MAX_COINS);
  });

  it("buys an item once, only with enough coins", () => {
    expect(buy(100, [], "tree")).toEqual({ ok: false, reason: "unknown" });
    expect(buy(PRICES.pond! - 1, [], "pond")).toEqual({ ok: false, reason: "poor" });
    const r = buy(20, [], "pond");
    expect(r).toEqual({ ok: true, coins: 20 - PRICES.pond!, owned: ["pond"] });
    expect(buy(20, ["pond"], "pond")).toEqual({ ok: false, reason: "owned" });
  });

  it("keeps the starter set free and adds bought items through the decor hook", () => {
    for (const k of SHOP_ITEMS) expect(STARTER_SET).not.toContain(k);
    expect(ownedItems(["pond"])).toEqual([...STARTER_SET, "pond"]);
  });

  it("parses saved coins and items safely", () => {
    expect(parseCoins("12")).toBe(0);
    expect(parseCoins(12.7)).toBe(12);
    expect(parseCoins(-3)).toBe(0);
    expect(parseOwned(["pond", "pond", "tree", "x", 3])).toEqual(["pond"]);
    expect(parseOwned(null)).toEqual([]);
  });
});
