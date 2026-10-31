import { DAY_SECONDS } from "../life/clock";
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../sim/rng";
import type { Bond } from "./bonds";
import { bestCrop, boardRows, judge, newMarket, newPurse, openDay, parseOffer, parsePurseLine, parseTradeLine, priceAnswer, priceOf, purseLine, record, sellStock, tradeLine, wantOf, type Good } from "./economy";
import { refusesChat } from "./jobs";
import { MindScheduler } from "./scheduler";
import { NpcVillage, type Pocket } from "./npcs";
import { VILLAGERS } from "./persona";

const [elder, mo, ama, pip] = VILLAGERS as [typeof VILLAGERS[0], typeof VILLAGERS[0], typeof VILLAGERS[0], typeof VILLAGERS[0]];
const bond = (fondness: number, trust = 0): Bond => ({ fondness, trust, respect: 0, why: [] });
const market = (day = 3) => {
  const m = newMarket();
  openDay(m, day, VILLAGERS);
  return m;
};

describe("market", () => {
  it("wants and supply move a price, and a new day eases the glut", () => {
    const m = newMarket();
    m.day = 0;
    expect(priceOf(m, "carrot")).toBe(6);
    m.wanted.carrot = ["Pip"];
    expect(priceOf(m, "carrot")).toBe(8);
    record(m, { who: "Mo", good: "fish", qty: 5, price: 7 });
    expect(priceOf(m, "fish")).toBeLessThan(7);
    openDay(m, 1, []);
    expect(m.sold.fish).toBe(2);
    expect(priceOf(m, "carrot")).toBe(6);
  });

  it("wants are the same on every machine", () => {
    expect(wantOf(pip, 4)).toBe(wantOf(pip, 4));
    expect(new Set([0, 1, 2, 3, 4].map((d) => wantOf(pip, d))).size).toBe(2);
  });

  it("a villager plants what the board pays for, within its coins", () => {
    const m = market();
    m.wanted = { carrot: ["Pip", "Mo"] };
    expect(bestCrop(m, 2)?.good).toBe("carrot");
    expect(bestCrop(m, 2)?.why).toContain("on the board");
    expect(bestCrop(newMarket(), 0)).toBeNull();
  });

  it("selling stock keeps one liked good, pays less per unit and shows on the board", () => {
    const m = market();
    const p = newPurse();
    p.goods = { fish: 5, carrot: 2 };
    const ts = sellStock(m, p, pip);
    expect(p.goods).toEqual({ carrot: 1 });
    expect(ts.map((t) => t.good).sort()).toEqual(["carrot", "fish"]);
    expect(ts.find((t) => t.good === "fish")!.qty).toBe(5);
    expect(m.sold.fish).toBe(5);
    expect(boardRows(m).some((r) => r.label === "Pip sold 5 fish")).toBe(true);
  });

  it("purse and trade lines survive the room", () => {
    const p = newPurse();
    p.coins = 40;
    p.goods = { wood: 3 };
    p.crop = "tomato";
    p.grown = 1;
    expect(parsePurseLine(purseLine(p))).toEqual(p);
    const t = { who: "Kai", good: "carrot" as Good, qty: 2, price: 6 };
    expect(parseTradeLine(tradeLine(t))).toEqual(t);
    expect(parseTradeLine("10:00 trade|x")).toBeNull();
  });
});

describe("prices are read from the books", () => {
  it("names the board price, or what is in stock", () => {
    const m = market();
    const p = newPurse();
    p.goods = { fish: 2 };
    expect(priceAnswer("how much is a carrot?", m, p)).toContain(`${priceOf(m, "carrot")} coins`);
    expect(priceAnswer("what do you have?", m, p)).toContain("2 fish");
    expect(priceAnswer("nice carrots", m, p)).toBeNull();
  });
});

describe("offers in plain words", () => {
  it.each([
    ["here's a carrot for you", { kind: "gift", good: "carrot", qty: 1, price: null }],
    ["I brought you 2 tomatoes", { kind: "gift", good: "tomato", qty: 2, price: null }],
    ["sell me a fish", { kind: "buy", good: "fish", qty: 1, price: null }],
    ["can I buy 2 wood for 8 coins", { kind: "buy", good: "wood", qty: 2, price: 4 }],
    ["I'll sell you three carrots for 7 each", { kind: "sell", good: "carrot", qty: 3, price: 7 }],
    ["do you want to buy my wheat", { kind: "sell", good: "wheat", qty: 1, price: null }],
  ])("%s", (line, want) => expect(parseOffer(line)).toEqual(want));

  it("a line about a good with no offer in it is not one", () => {
    expect(parseOffer("the fish here are huge")).toBeNull();
    expect(parseOffer("nice day")).toBeNull();
  });
});

describe("deals keep to the sim's bounds", () => {
  const offer = (kind: "gift" | "sell" | "buy", good: Good, price: number | null, qty = 1) => ({ kind, good, qty, price });
  const rich = () => ({ ...newPurse(), coins: 100, goods: { fish: 3 } });

  it("a gift needs the goods, and a grudge turns it away", () => {
    expect(judge(pip, undefined, rich(), market(), offer("gift", "carrot", null), "Kai", 0, 0).answer).toBe("refuse");
    expect(judge(pip, undefined, rich(), market(), offer("gift", "carrot", null), "Kai", 0, 1).answer).toBe("accept");
    expect(judge(pip, bond(0, -30), rich(), market(), offer("gift", "carrot", null), "Kai", 0, 1).why).toContain("Keep your carrot");
  });

  it("selling: fair is taken, a stretch is countered, greed is refused, and nobody pays what it lacks", () => {
    const m = market();
    const fair = priceOf(m, "carrot");
    expect(judge(pip, undefined, rich(), m, offer("sell", "carrot", fair), "Kai", 0, 1)).toMatchObject({ answer: "accept", price: fair });
    expect(judge(pip, undefined, rich(), m, offer("sell", "carrot", fair + 2), "Kai", 0, 1)).toMatchObject({ answer: "counter", price: fair });
    expect(judge(pip, undefined, rich(), m, offer("sell", "carrot", fair * 3), "Kai", 0, 1).answer).toBe("refuse");
    expect(judge(pip, undefined, { ...newPurse(), coins: 1 }, m, offer("sell", "carrot", fair), "Kai", 0, 1).why).toContain("only have 1");
  });

  it("a villager buys only what it has a use for; the keeper buys anything", () => {
    const m = market();
    expect(judge(pip, undefined, rich(), m, offer("sell", "wood", null), "Kai", 0, 1).why).toContain("no use for wood");
    expect(judge(ama, undefined, rich(), m, offer("sell", "wood", null), "Kai", 0, 1).answer).toBe("accept");
  });

  it("buying: no stock, no sale; a friend pays less than a stranger", () => {
    const m = market();
    expect(judge(mo, undefined, newPurse(), m, offer("buy", "fish", null), "Kai", 50, 0).answer).toBe("refuse");
    const stranger = judge(mo, undefined, rich(), m, offer("buy", "fish", null), "Kai", 50, 0);
    const friend = judge(mo, bond(60), rich(), m, offer("buy", "fish", null), "Kai", 50, 0);
    expect(friend.price).toBeLessThan(stranger.price);
    expect(judge(mo, undefined, rich(), m, offer("buy", "fish", null), "Kai", 1, 0).why).toContain("You have 1");
  });

  it("someone a villager refuses to deal with gets a reason", () => {
    const b = { ...bond(-40, -5), why: [{ day: 1, beat: "rude" as const, text: "Kai was rude to me" }] };
    expect(judge(elder, b, rich(), market(), offer("buy", "fish", null), "Kai", 50, 0).why).toContain("you were rude");
  });

  it("only the deep cold shoulder stops a chat", () => {
    expect(refusesChat(pip, bond(-10))).toBe(false);
    expect(refusesChat(pip, bond(-20))).toBe(true);
    expect(refusesChat(elder, bond(-20))).toBe(false);
  });
});

function town() {
  const lines: { who?: string; mem?: string }[] = [];
  const said: string[] = [];
  const homes = { elder: { x: 0, z: 0 }, mo: { x: 20, z: 0 }, ama: { x: 0, z: 20 }, pip: { x: 20, z: 20 } };
  const spots = { home: [{ x: 0, z: 0 }], bed: [{ x: -3, z: 0 }] };
  const nv = new NpcVillage(new MindScheduler(() => null), () => false, { line: (l) => lines.push(l), say: (_, t) => said.push(t) }, homes, spots, () => true, undefined, mulberry32(5));
  const mine: { coins: number; goods: Partial<Record<Good, number>> } = { coins: 50, goods: { carrot: 3 } };
  const pocket: Pocket = { coins: () => mine.coins, count: (g) => mine.goods[g] ?? 0, change: (c, g, n) => { mine.coins += c; mine.goods[g] = (mine.goods[g] ?? 0) + n; } };
  nv.pocket = pocket;
  return { nv, lines, mine };
}

describe("deals in the village", () => {
  it("a gift moves goods and warms the bond, and the reason sticks", async () => {
    const { nv, mine } = town();
    const r = await nv.reply("pip", "Kai", "here's a carrot for you");
    expect(r?.text).toMatch(/Thank you|kind/);
    expect(mine.goods.carrot).toBe(2);
    expect(nv.purseOf("pip").goods.carrot).toBe(1);
    const mem = nv.hub.minds.get("pip")!.mem;
    expect(mem.bonds.Kai!.why.at(-1)!.text).toBe("Kai gave me 1 carrot");
  });

  it("a counter waits for a yes, then coins and goods change hands once", async () => {
    const { nv, mine, lines } = town();
    const fair = priceOf(nv.market, "carrot");
    await nv.reply("pip", "Kai", "hello");
    const r = await nv.reply("pip", "Kai", `I'll sell you a carrot for ${fair + 4} coins`);
    if (!r!.text.endsWith("Deal?")) throw new Error(r!.text);
    const price = Number(/pay (\d+)/.exec(r!.text)![1]);
    await nv.reply("pip", "Kai", "deal");
    expect(mine.coins).toBe(50 + price);
    expect(mine.goods.carrot).toBe(2);
    expect(lines.some((l) => l.mem?.startsWith("trade|Kai|carrot|1|"))).toBe(true);
    await nv.reply("pip", "Kai", "ok");
    expect(mine.coins).toBe(50 + price);
  });

  it("a far-gone villager won't chat, but sorry gets through", async () => {
    const { nv } = town();
    const mem = nv.hub.minds.get("pip")!.mem;
    mem.bonds.Kai = bond(-30);
    expect((await nv.reply("pip", "Kai", "nice weather"))?.text).toContain("nothing to say");
    expect((await nv.reply("pip", "Kai", "I am so sorry"))?.text ?? "").not.toContain("nothing to say");
  });

  it("left alone for three days, the town works, plants and sells", () => {
    const homes = { elder: { x: 0, z: 0 }, mo: { x: 12, z: 0 }, ama: { x: 0, z: 12 }, pip: { x: 12, z: 12 } };
    const here = [{ x: 6, z: 6 }];
    const spots = { home: [{ x: 0, z: 0 }], bed: [{ x: -3, z: 0 }], stall: here, woods: [{ x: 9, z: 9 }], pond: [{ x: 3, z: 9 }], lawn: [{ x: 6, z: 0 }] };
    const nv = new NpcVillage(new MindScheduler(() => null), () => false, { line: () => {}, say: () => {} }, homes, spots, () => true, undefined, mulberry32(7));
    for (let s = 0; s < 3 * DAY_SECONDS; s += 0.5) nv.step(0.5, nv.v.t + 0.5);
    const log = [...nv.hub.minds.values()].flatMap((m) => m.mem.log.map((e) => e.text));
    expect(log.some((t) => /^planted /.test(t) || /^harvested /.test(t))).toBe(true);
    expect(log.some((t) => /at the market for/.test(t))).toBe(true);
    expect(nv.market.trades.length).toBeGreaterThan(0);
  });

  it("the economy runs over days: goods are earned and sold, coins rise, purses reach the room", () => {
    const { nv, lines } = town();
    const elder = nv.v.agents.find((a) => a.id === "elder")!;
    expect(elder).toBeTruthy();
    const e = (act: string) => (nv as unknown as { earn(e: unknown): void }).earn({ kind: "done", who: "pip", act, with: [] });
    const purse = (nv.hub.minds.get("pip")!.mem.purse = newPurse());
    e("chop");
    expect(purse.goods.wood).toBe(2);
    (nv as unknown as { earn(e: unknown): void }).earn({ kind: "start", who: "pip", act: "farm", with: [] });
    expect(purse.crop).toBeTruthy();
    const crop = purse.crop!;
    e("farm");
    e("farm");
    expect(purse.goods[crop]).toBe(3);
    const before = purse.coins;
    (nv as unknown as { earn(e: unknown): void }).earn({ kind: "done", who: "ama", act: "sell", with: [] });
    expect(purse.coins).toBeGreaterThan(before);
    expect(lines.some((l) => l.who === "pip" && l.mem?.startsWith("trade|Pip|wood"))).toBe(true);
    nv.step(0.25, nv.v.t + 0.25);
    expect(lines.some((l) => l.who === "pip" && l.mem?.startsWith("purse|"))).toBe(true);
  });
});
