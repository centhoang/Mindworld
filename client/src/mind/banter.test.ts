// P5d: villagers talk to each other and tell campfire stories from the cloud, with their memories; the cloud is
// mocked here. Without it (off, failing, or nobody near to hear) the local mind or the scripted lines play.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gameTime } from "../life/clock";
import { mulberry32 } from "../sim/rng";
import type { MindLine } from "../world/live";
import type { BanterAsk, Banter } from "../game/banter-api";
import { remember } from "./memory";
import { NpcVillage } from "./npcs";
import { MindScheduler } from "./scheduler";

const HOMES = { elder: { x: 0, z: 0 }, mo: { x: 2, z: 0 }, ama: { x: 0, z: 2 }, pip: { x: 2, z: 2 } };
const SPOTS = { home: [{ x: 0, z: 0 }], bed: [{ x: -3, z: 0 }], lawn: [{ x: 0, z: 3 }], campfire: [{ x: 0, z: 0 }, { x: 1, z: 0 }] };

function make(reply: Banter | null = null) {
  const lines: (MindLine & { mem?: string })[] = [];
  const bubbles: [string, string][] = [];
  const asks: BanterAsk[] = [];
  const nv = new NpcVillage(new MindScheduler(() => null), () => false, { line: (l) => lines.push(l), say: (id, t) => bubbles.push([id, t]) }, HOMES, SPOTS, () => true, undefined, mulberry32(5));
  nv.banter = async (ask) => (asks.push(ask), reply);
  nv.people = () => [{ id: "p1", name: "Kai", pos: { x: 1, z: 1 } }];
  const agent = (id: string) => nv.v.agents.find((a) => a.id === id)!;
  const sit = (...ids: string[]) => {
    for (const id of ids) Object.assign(agent(id), { state: "do", act: "campfire", left: 60, pos: { x: 0.5, z: 0 } });
  };
  return { nv, lines, bubbles, asks, agent, sit };
}

const STORY: Banter = { lines: [{ who: "elder", text: "Gather close, Kai and Mo." }, { who: "elder", text: "Today Kai's pet Bolt beat a wild Brute!" }, { who: "mo", text: "Huh. That Bolt is quick." }], by: "Muse Spark Open" };

describe("villagers' talks and campfire stories from the cloud", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("two villagers I host talk: one cloud call writes the whole talk, with both minds' notes and who can hear", async () => {
    const { nv, bubbles, asks, agent } = make({ lines: [{ who: "elder", text: "Mo, Kai came to my picnic." }, { who: "mo", text: "Good. Kai keeps a promise." }], by: "Muse Spark Open" });
    const elder = nv.hub.minds.get("elder")!;
    remember(elder.mem, 0, "10:00", "Kai's picnic: I went and Kai came", 8);
    const talk = nv.hub.talk(agent("elder"), agent("mo"));
    await vi.runAllTimersAsync();
    await talk;
    expect(asks).toHaveLength(1);
    expect(asks[0]).toMatchObject({ kind: "chat", who: ["elder", "mo"], speak: ["elder", "mo"], listeners: ["Kai"] });
    expect(asks[0]!.notes.elder).toContain("Kai's picnic: I went and Kai came");
    expect(asks[0]!.lines).toBeGreaterThanOrEqual(2);
    const said = bubbles.filter(([, t]) => t !== "...").map(([id, t]) => `${id}: ${t}`);
    expect(said.slice(0, 2)).toEqual(["elder: Mo, Kai came to my picnic.", "mo: Good. Kai keeps a promise."]);
    expect(elder.source).toBe("Muse Spark Open");
    expect(elder.mem.log.at(-1)!.text).toBe('talked with Mo: "Good. Kai keeps a promise."');
  });

  it("a villager's notes: what happened, the notable first, prices in coins; not its own small talk", () => {
    const { nv } = make();
    const mem = nv.hub.minds.get("ama")!.mem;
    remember(mem, 0, "09:00", "sold 2 fish at the market for 14c");
    remember(mem, 0, "09:30", 'I said to Kai "Hello there, want some soup?"');
    remember(mem, 0, "09:40", "said hello to Bolt");
    remember(mem, 0, "08:00", "Kai's picnic: I went and Kai came", 8);
    const notes = nv.notesOf("ama");
    expect(notes).toContain("08:00 Kai's picnic: I went and Kai came; 09:00 sold 2 fish at the market for 14 coins");
    expect(notes).not.toMatch(/I said to|said hello/);
  });

  it("nobody near to hear, or the cloud failing: no cloud call, or the scripted lines play", async () => {
    const far = make({ lines: [{ who: "elder", text: "Hello Mo!" }], by: "Muse Spark Open" });
    far.nv.people = () => [{ id: "p1", name: "Kai", pos: { x: 40, z: 40 } }];
    const t1 = far.nv.hub.talk(far.agent("elder"), far.agent("mo"));
    await vi.runAllTimersAsync();
    await t1;
    expect(far.asks).toHaveLength(0);
    expect(far.bubbles.filter(([, t]) => t !== "...").length).toBeGreaterThanOrEqual(2); // scripted lines
    expect(far.nv.hub.minds.get("elder")!.source).toBe("rules");

    const down = make(null);
    const t2 = down.nv.hub.talk(down.agent("elder"), down.agent("mo"));
    await vi.runAllTimersAsync();
    await t2;
    expect(down.asks).toHaveLength(1);
    expect(down.bubbles.filter(([, t]) => t !== "...").length).toBeGreaterThanOrEqual(2);
  });

  it("at most one cloud talk per 40 s on a machine", async () => {
    const { nv, asks, agent } = make({ lines: [{ who: "ama", text: "Soup tonight, Pip!" }], by: "Muse Spark Open" });
    const t1 = nv.hub.talk(agent("ama"), agent("pip"));
    await vi.runAllTimersAsync();
    await t1;
    const t2 = nv.hub.talk(agent("elder"), agent("mo"));
    await vi.runAllTimersAsync();
    await t2;
    expect(asks).toHaveLength(1);
  });

  it("a villager on another machine talks to mine: my villager's next line from the cloud, the talk so far sent", async () => {
    const { nv, lines, asks, agent } = make({ lines: [{ who: "elder", text: "Hello Mo, fine fish today." }], by: "Muse Spark Open" });
    nv.me = "me";
    nv.setHost("elder", "me");
    nv.setHost("mo", "other");
    agent("mo").pos = { x: 1, z: 0 };
    nv.hear({ who: "mo", say: "Morning, Elder!", to: "elder" });
    await vi.runAllTimersAsync();
    expect(asks[0]).toMatchObject({ kind: "chat", who: ["elder", "mo"], speak: ["elder"], said: ["Mo: Morning, Elder!"], lines: 1 });
    expect(lines.find((l) => l.who === "elder" && l.say)).toMatchObject({ say: "Hello Mo, fine fish today.", to: "mo" });
  });

  it("evening at the campfire with a player sitting by: the villager with the most to tell tells a story, the others react", async () => {
    const { nv, lines, asks, sit } = make(STORY);
    sit("elder", "mo");
    remember(nv.hub.minds.get("elder")!.mem, 0, "18:00", "watched Kai's pet Bolt beat a wild Brute", 6);
    expect(nv.storyNow()).toBe(true);
    await vi.runAllTimersAsync();
    expect(asks[0]).toMatchObject({ kind: "story", who: ["elder", "mo"], speak: ["elder", "mo"], listeners: ["Kai"], place: "the campfire" });
    expect(asks[0]!.notes.elder).toContain("watched Kai's pet Bolt beat a wild Brute");
    expect(lines.filter((l) => l.say).map((l) => `${l.who}: ${l.say}`)).toEqual([expect.stringMatching(/^elder: Gather close, Kai and Mo/), "elder: Today Kai's pet Bolt beat a wild Brute!", "mo: Huh. That Bolt is quick."]);
    expect(nv.hub.minds.get("elder")!.mem.log.at(-1)!.text).toBe(`told Kai a campfire story: "Today Kai's pet Bolt beat a wild Brute!"`);
    expect(nv.hub.minds.get("mo")!.mem.log.at(-1)!.text).toBe("heard Elder's campfire story with Kai");
    expect(nv.hub.minds.get("mo")!.source).toBe("Muse Spark Open");
  });

  it("no player by the fire: no story; cloud off: the free story tells what really happened today", async () => {
    const empty = make(STORY);
    empty.sit("elder");
    empty.nv.people = () => [{ id: "p1", name: "Kai", pos: { x: 30, z: 0 } }];
    expect(empty.nv.storyNow()).toBe(false);

    const { nv, lines, sit } = make(null);
    nv.banter = null;
    sit("elder", "ama");
    remember(nv.hub.minds.get("elder")!.mem, gameTime(nv.v.t).day, "18:00", "watched Kai's pet Bolt beat a wild Brute", 6);
    expect(nv.storyNow()).toBe(true);
    await vi.runAllTimersAsync();
    expect(lines.filter((l) => l.say).map((l) => `${l.who}: ${l.say}`)).toEqual([
      "elder: Gather close, everyone. Let me tell you about today.",
      "elder: Today I watched Kai's pet Bolt beat a wild Brute.",
      "ama: Oh, I love that one!",
    ]);
    expect(nv.hub.minds.get("elder")!.source).toBe("rules");
  });

  it("once an evening: the story starts by itself only in the evening, and only once that game day", async () => {
    const { nv, asks, sit } = make(STORY);
    const evening = (17.5 - 8) * 30; // 17:30 on day 0
    sit("elder", "mo");
    const stories = () => asks.filter((a) => a.kind === "story");
    nv.step(0.25, 60); // morning: no story
    expect(stories()).toHaveLength(0);
    sit("elder", "mo");
    nv.step(0.25, evening);
    expect(stories()).toHaveLength(1);
    await vi.runAllTimersAsync();
    sit("elder", "mo");
    nv.step(0.25, evening + 10);
    expect(stories()).toHaveLength(1);
  });
});
