import { DAY_SECONDS, gameTime } from "../life/clock";
import { pairKey } from "../life/relations";
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../sim/rng";
import type { MindLine } from "../world/live";
import { NpcVillage } from "./npcs";
import { answerTo, offerIn } from "./offers";
import { MindScheduler } from "./scheduler";

const HOMES = { elder: { x: 0, z: 0 }, mo: { x: 2, z: 0 }, ama: { x: 0, z: 2 }, pip: { x: 2, z: 2 } };
const SPOTS = { home: [{ x: 0, z: 0 }], bed: [{ x: -3, z: 0 }], lawn: [{ x: 0, z: 3 }], picnic: [{ x: 3, z: 3 }] };

function make() {
  const lines: (MindLine & { mem?: string })[] = [];
  const bubbles: [string, string][] = [];
  const nv = new NpcVillage(new MindScheduler(() => null), () => false, { line: (l) => lines.push(l), say: (id, t) => bubbles.push([id, t]) }, HOMES, SPOTS, () => true, undefined, mulberry32(5));
  return { nv, lines, bubbles };
}
const run = (nv: NpcVillage, seconds: number) => {
  for (let s = 0; s < seconds; s += 0.25) nv.step(0.25, nv.v.t + 0.25);
};

describe("NpcVillage", () => {
  it("offline (no room), the NPCs' minds run here", () => {
    const { nv } = make();
    expect(nv.hub.minds.size).toBe(4);
    run(nv, 30);
    expect(nv.v.agents.some((a) => a.state !== "idle" || nv.hub.minds.get(a.id)!.talking)).toBe(true); // busy or chatting
  });

  it("in a room with nobody hosting, they live on utility and run no mind here", () => {
    const { nv, lines } = make();
    nv.me = "me";
    expect(nv.hub.minds.size).toBe(0);
    run(nv, 30);
    expect(nv.v.agents.some((a) => a.state !== "idle")).toBe(true);
    expect(lines.filter((l) => l.say || l.act)).toEqual([]);
  });

  it("the host runs the mind and sends act lines for its NPC only", () => {
    const { nv, lines } = make();
    nv.me = "me";
    nv.setHost("mo", "me");
    nv.setHost("elder", "other");
    expect(nv.hub.minds.has("mo")).toBe(true);
    expect(nv.hub.minds.has("elder")).toBe(false);
    run(nv, 30);
    expect(lines.some((l) => l.who === "mo" && l.act)).toBe(true);
    expect(lines.some((l) => l.who === "elder")).toBe(false);
  });

  it("a replaying NPC waits for its host's act, then does it", () => {
    const { nv, bubbles } = make();
    nv.me = "me";
    nv.setHost("elder", "other");
    const elder = nv.v.agents.find((a) => a.id === "elder")!;
    run(nv, 5);
    expect(elder.state).toBe("idle"); // waiting for the host
    nv.hear({ who: "elder", act: "wander", say: "Good morning!" });
    run(nv, 1);
    expect(elder.act).toBe("wander");
    expect(bubbles).toContainEqual(["elder", "Good morning!"]);
  });

  it("decides itself when the host stays silent too long", () => {
    const { nv } = make();
    nv.me = "me";
    nv.setHost("pip", "other");
    run(nv, 25);
    expect(nv.v.agents.find((a) => a.id === "pip")!.state).not.toBe("idle");
  });

  it("handover: the memory from the room seeds the mind, new memories go back out", () => {
    const { nv, lines } = make();
    nv.me = "me";
    nv.setMemory("ama", ["08:10 cooked soup for Pip"]);
    nv.setHost("ama", "me");
    expect(nv.hub.minds.get("ama")!.mem.log[0]!.text).toBe("cooked soup for Pip");
    run(nv, 400);
    const mems = lines.filter((l) => l.who === "ama" && l.mem && !/^(purse|trade)\|/.test(l.mem));
    expect(mems.length).toBeGreaterThan(0);
    expect(mems.every((l) => /^\d\d:\d\d /.test(l.mem!) && !l.mem!.includes("cooked soup"))).toBe(true);
    nv.setHost("ama", "other"); // moved away: the mind stops here
    expect(nv.hub.minds.has("ama")).toBe(false);
  });
});

describe("NpcVillage talk with the player", () => {
  it("a hosted NPC answers from its own mind and remembers it; otherwise null (cloud)", async () => {
    const lines: (MindLine & { mem?: string })[] = [];
    const lm = { label: "fake 1B", ready: () => true, complete: async () => "The fish bite at dawn, friend." };
    const nv = new NpcVillage(new MindScheduler(() => lm, { duty: 1 }), () => true, { line: (l) => lines.push(l), say: () => {} }, HOMES, SPOTS, () => true);
    nv.me = "me";
    nv.setHost("mo", "other");
    expect(await nv.reply("mo", "Kai", "any tips?")).toBeNull(); // hosted elsewhere
    nv.setHost("mo", "me");
    const r = await nv.reply("mo", "Kai", "any tips?");
    expect(r).toEqual({ text: "The fish bite at dawn, friend.", source: "fake 1B" });
    expect(nv.hub.minds.get("mo")!.mem.log.at(-1)!.text).toContain("Kai asked");
    expect(lines).toContainEqual({ who: "mo", say: "The fish bite at dawn, friend." });
  });
});

describe("NpcVillage starts talks", () => {
  const lmSays = (text: string) => ({ label: "fake 1B", ready: () => true, complete: async () => text });
  const settle = () => new Promise((r) => setTimeout(r, 0));

  it("a hosted NPC greets a player who walks up, once in a while, addressed to that player", async () => {
    const lines: (MindLine & { mem?: string })[] = [];
    const nv = new NpcVillage(new MindScheduler(() => lmSays("Hello there, Kai!"), { duty: 1 }), () => true, { line: (l) => lines.push(l), say: () => {} }, HOMES, SPOTS, () => true, undefined, mulberry32(2));
    nv.me = "me1";
    nv.setHost("mo", "me1");
    nv.people = () => [{ id: "p2", name: "Kai", pos: { ...nv.v.agents.find((a) => a.id === "mo")!.pos } }];
    nv.step(0.25, nv.v.t + 0.25);
    for (let i = 0; i < 5; i++) await settle();
    expect(lines).toContainEqual({ who: "mo", say: "Hello there, Kai!", to: "p2" });
    const n = lines.filter((l) => l.say).length;
    nv.step(0.25, nv.v.t + 0.25); // no second greeting right away
    for (let i = 0; i < 5; i++) await settle();
    expect(lines.filter((l) => l.say).length).toBe(n);
  });

  it("an NPC spoken to by another machine's NPC answers it, a few turns at most", async () => {
    const lines: (MindLine & { mem?: string })[] = [];
    const nv = new NpcVillage(new MindScheduler(() => lmSays("Nice catch today!"), { duty: 1 }), () => true, { line: (l) => lines.push(l), say: () => {} }, HOMES, SPOTS, () => true);
    nv.me = "me1";
    nv.setHost("ama", "me1");
    nv.setHost("mo", "other");
    for (let k = 0; k < 5; k++) {
      nv.hear({ who: "mo", say: `line ${k}`, to: "ama" });
      for (let i = 0; i < 5; i++) await settle();
    }
    const said = lines.filter((l) => l.who === "ama" && l.say);
    expect(said[0]).toEqual({ who: "ama", say: "Nice catch today!", to: "mo" });
    expect(said.length).toBe(3);
    nv.hear({ who: "mo", say: "hi Pip", to: "pip" }); // not mine to answer
    for (let i = 0; i < 5; i++) await settle();
    expect(lines.filter((l) => l.who === "pip")).toEqual([]);
  });
});

describe("NpcVillage talks to pets", () => {
  const lmSays = (text: string) => ({ label: "fake 1B", ready: () => true, complete: async () => text });
  const settle = async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
  };
  function host(lm: string | null) {
    const lines: (MindLine & { mem?: string })[] = [];
    const nv = new NpcVillage(new MindScheduler(() => (lm === null ? null : lmSays(lm)), { duty: 1 }), () => lm !== null, { line: (l) => lines.push(l), say: () => {} }, HOMES, SPOTS, () => true, undefined, mulberry32(2));
    nv.me = "me1";
    nv.setHost("mo", "me1");
    const mo = nv.v.agents.find((a) => a.id === "mo")!;
    const tick = async (dt = 0.25) => {
      mo.state = "idle";
      mo.idle = 1e6; // stays put between ticks
      nv.step(0.25, nv.v.t + dt);
      await settle();
    };
    const said = () => lines.filter((l) => l.who === "mo" && l.say).map((l) => l);
    return { nv, mo, tick, said };
  }

  it("a hosted NPC says a line to a resting pet nearby, over the room, from its mind", async () => {
    const { nv, mo, tick, said } = host("Hello little Sprig, nap time?");
    nv.pets = () => [{ id: "r0", name: "Sprig", pos: { x: mo.pos.x + 1, z: mo.pos.z } }];
    await tick();
    expect(said()).toEqual([{ who: "mo", say: "Hello little Sprig, nap time?" }]);
    expect(nv.hub.minds.get("mo")!.mem.log.at(-1)!.text).toContain("Sprig");
  });

  it("falls back to a scripted line without a model or when the model says nothing usable", async () => {
    for (const lm of [null, ""]) {
      const { nv, mo, tick, said } = host(lm);
      nv.pets = () => [{ id: "r0", name: "Sprig", pos: { ...mo.pos } }];
      await tick();
      expect(said().filter((l) => l.say!.includes("Sprig")).length, String(lm)).toBe(1);
      expect(nv.hub.minds.get("mo")!.source).toBe("rules");
    }
  });

  it("is rate-limited per pair and per NPC, and skips busy or far pets", async () => {
    const { nv, mo, tick, said } = host(null);
    let pets = [{ id: "r0", name: "Sprig", pos: { x: 0, z: 0 }, busy: true }];
    nv.pets = () => pets.map((p) => ({ ...p, pos: p.id === "far" ? { x: mo.pos.x + 9, z: mo.pos.z } : { ...mo.pos } }));
    await tick();
    expect(said().length).toBe(0); // busy
    pets = [{ id: "far", name: "Far", pos: { x: 0, z: 0 }, busy: false }];
    await tick();
    expect(said().length).toBe(0); // too far
    pets = [{ id: "r0", name: "Sprig", pos: { x: 0, z: 0 }, busy: false }, { id: "r1", name: "Mallow", pos: { x: 0, z: 0 }, busy: false }];
    await tick();
    expect(said().length).toBe(1);
    await tick(5);
    expect(said().length).toBe(1); // not the next pet right away
    await tick(40);
    expect(said().length).toBe(2); // the other pet, after the NPC's own gap
    await tick(40);
    expect(said().length).toBe(2); // both pets talked to recently
    await tick(200);
    expect(said().length).toBe(3); // the pair gap is over
  });

  describe("promises", () => {
    const LINE = "come to my birthday party tomorrow evening, we will dance!";
    const setup = () => {
      const m = make();
      m.nv.people = () => [];
      return { ...m, pip: m.nv.hub.minds.get("pip")! };
    };
    const eveningOf = (day: number) => {
      let t = day * DAY_SECONDS;
      while (gameTime(t).phase !== "evening") t += 10;
      return t;
    };
    const tick = (nv: NpcVillage, seconds: number) => {
      for (let i = 0; i < seconds * 4; i++) nv.step(0.25, nv.v.t + 0.25);
    };

    it("turns an invitation into a promise, without a model too", async () => {
      const { nv, pip, lines } = setup();
      const r = await nv.reply("pip", "Kai", LINE);
      expect(r?.text).toContain("Yes, Kai");
      expect(pip.mem.promises[0]).toMatchObject({ from: "Kai", act: "dance", occasion: "birthday party", phase: "evening", day: 1, state: "open" });
      expect(lines.some((l) => (l as { mem?: string }).mem?.startsWith("promise|"))).toBe(true);
    });

    it("lets a stranger with no interest decline, so no promise is made", async () => {
      const { nv } = setup();
      nv.v.rel.set(pairKey("elder", "Kai"), -100);
      const r = await nv.reply("elder", "Kai", "come fishing tomorrow morning");
      expect(r?.text).not.toContain("Yes");
      expect(nv.hub.minds.get("elder")!.mem.promises).toEqual([]);
    });

    it("goes when it is due, and a player who shows up keeps it", async () => {
      const { nv, pip } = setup();
      await nv.reply("pip", "Kai", LINE);
      nv.v.t = eveningOf(1);
      const a = nv.v.agents.find((x) => x.id === "pip")!;
      Object.assign(a, { state: "idle", act: null, idle: 0, gather: null });
      nv.people = () => [{ id: "me", name: "Kai", pos: a.pos }];
      tick(nv, 40);
      expect(pip.mem.promises[0]!.state).toBe("kept");
      expect(nv.v.rel.get(pairKey("pip", "Kai"))).toBeGreaterThan(0);
      expect(pip.mem.facts.join()).toContain("I went and Kai came");
    });

    it("remembers being stood up, and likes the player less", async () => {
      const { nv, pip } = setup();
      await nv.reply("pip", "Kai", LINE);
      nv.v.t = eveningOf(1);
      const a = nv.v.agents.find((x) => x.id === "pip")!;
      Object.assign(a, { state: "idle", act: null, idle: 0, gather: null });
      tick(nv, 10);
      nv.v.t = eveningOf(2);
      tick(nv, 1);
      expect(pip.mem.promises[0]!.state).toBe("broken");
      expect(nv.v.rel.get(pairKey("pip", "Kai"))).toBeLessThan(0);
      expect(pip.mem.facts.join()).toContain("Kai stood me up");
    });

    it("does not blame the player when the NPC never got there", async () => {
      const { nv, pip } = setup();
      await nv.reply("pip", "Kai", LINE);
      nv.v.t = eveningOf(2);
      tick(nv, 1);
      expect(pip.mem.promises[0]!.state).toBe("cancelled");
      expect(nv.v.rel.get(pairKey("pip", "Kai")) ?? 0).toBe(0);
    });

    it("says so when there is nowhere to do it, and promises nothing", async () => {
      const { nv, pip } = setup();
      nv.setSpots({ ...nv.env.spots, lawn: [] });
      const r = await nv.reply("pip", "Kai", LINE);
      expect(r?.text).toContain("nowhere");
      expect(pip.mem.promises).toEqual([]);
    });

    it("hands an open promise to the next host through the room log", async () => {
      const { nv, pip, lines } = setup();
      await nv.reply("pip", "Kai", LINE);
      const line = (lines.map((l) => (l as { mem?: string }).mem).find((x) => x?.startsWith("promise|")))!;
      pip.mem.promises = [];
      nv.setMemory("pip", ["08:10 ate", line]);
      expect(pip.mem.promises[0]).toMatchObject({ from: "Kai", state: "open" });
      expect(pip.mem.log.map((e) => e.text).join()).not.toContain("promise|");
    });

    const stoodUp = async () => {
      const made = setup();
      const { nv } = made;
      await nv.reply("pip", "Kai", LINE);
      nv.v.t = eveningOf(1);
      Object.assign(nv.v.agents.find((x) => x.id === "pip")!, { state: "idle", act: null, idle: 0, gather: null });
      tick(nv, 10);
      nv.v.t = eveningOf(2);
      tick(nv, 1);
      return made;
    };

    it("gives the real reason when asked, and trust costs the next yes", async () => {
      const { nv, pip } = await stoodUp();
      expect(pip.mem.bonds.Kai!.trust).toBeLessThan(0);
      expect(pip.mem.why).toContain("stood me up");
      expect((await nv.reply("pip", "Kai", "why are you mad at me?"))?.text).toContain("you stood me up");
      const r = await nv.reply("pip", "Kai", "come dance tomorrow evening?");
      expect(pip.mem.promises.filter((c) => c.state === "open")).toEqual([]);
      expect(r?.text).toContain("Last time, you stood me up");
      await nv.reply("pip", "Kai", "I am sorry about that");
      expect((await nv.reply("pip", "Kai", "come dance tomorrow evening?"))?.text).toContain("Yes, Kai");
    });

    it("tells the place when it accepts, and says the grudge to your face once", async () => {
      const { nv, bubbles } = await stoodUp();
      const a = nv.v.agents.find((x) => x.id === "pip")!;
      expect((await setup().nv.reply("pip", "Kai", LINE))?.text).toContain("Meet me at the lawn");
      const pipSays = () => bubbles.filter(([id, t]) => id === "pip" && t.includes("you stood me up"));
      nv.people = () => [{ id: "me", name: "Kai", pos: a.pos }];
      Object.assign(a, { state: "idle", act: null, idle: 5, gather: null });
      nv.step(0.25, nv.v.t + 0.25);
      expect(pipSays()).toHaveLength(1);
      (nv as unknown as { greeted: Map<string, number> }).greeted.clear();
      Object.assign(a, { state: "idle", act: null, idle: 5, gather: null });
      nv.step(0.25, nv.v.t + 0.25);
      expect(pipSays()).toHaveLength(1);
    });

    it("does not bring the grudge up again when the talk already said it", async () => {
      const { nv, bubbles } = await stoodUp();
      const a = nv.v.agents.find((x) => x.id === "pip")!;
      expect((await nv.reply("pip", "Kai", "why are you upset with me?"))?.text).toContain("you stood me up");
      nv.people = () => [{ id: "me", name: "Kai", pos: a.pos }];
      (nv as unknown as { greeted: Map<string, number> }).greeted.clear();
      Object.assign(a, { state: "idle", act: null, idle: 5, gather: null });
      nv.step(0.25, nv.v.t + 0.25);
      expect(bubbles.filter(([id, t]) => id === "pip" && t.startsWith("Kai, you stood me up"))).toHaveLength(0);
    });

    it("learns what a player likes and how they treat it", async () => {
      const { nv, pip } = setup();
      await nv.reply("pip", "Kai", "I love carrots, thank you");
      expect(pip.mem.beliefs[0]).toMatchObject({ about: "Kai", text: "likes carrots", source: "" });
      expect(pip.mem.bonds.Kai!.fondness).toBeGreaterThan(0);
    });

    it("hands bonds and beliefs to the next host through the room log", async () => {
      const { nv, pip, lines } = await stoodUp();
      const mem = lines.map((l) => (l as { mem?: string }).mem ?? "").filter((x) => /^(bond|belief)\|/.test(x));
      expect(mem.every((x) => x.length <= 120)).toBe(true);
      const trust = pip.mem.bonds.Kai!.trust;
      pip.mem.bonds = {};
      pip.mem.beliefs = [];
      nv.v.rel.clear();
      nv.setMemory("pip", mem);
      expect(pip.mem.bonds.Kai!.trust).toBe(trust);
      expect(pip.mem.beliefs.map((b) => b.text)).toContain("broke a promise");
      expect(nv.v.rel.get(pairKey("pip", "Kai"))).toBeLessThan(0);
      expect((await nv.reply("pip", "Kai", "are you mad?"))?.text).toContain("you stood me up");
    });

    it("gossips a broken promise to a friend, who trusts the player less", async () => {
      const { nv, pip } = await stoodUp();
      const mo = nv.hub.minds.get("mo")!;
      nv.hub.minds.get("pip")!.lastTalk = -1e9;
      await nv.hub.talk(nv.v.agents.find((x) => x.id === "pip")!, nv.v.agents.find((x) => x.id === "mo")!);
      expect(mo.mem.beliefs[0]).toMatchObject({ about: "Kai", text: "broke a promise", source: "Pip" });
      expect(mo.mem.bonds.Kai!.trust).toBeLessThan(0);
      expect(mo.mem.why).toContain("Pip told me");
      expect(pip.mem.bonds.Mo).toBeUndefined();
    }, 20000);

    it("news passes on with every teller in the chain, and the next villager raises it", async () => {
      const { nv, pip } = await stoodUp();
      const [ama, elder] = [nv.hub.minds.get("ama")!, nv.hub.minds.get("elder")!];
      nv.hub.hearNews(ama, "Pip", "Kai", pip.mem.bonds.Kai!.why.at(-1)!.text);
      expect(ama.mem.bonds.Kai!.why.at(-1)!.text).toBe("Pip told me: Kai stood Pip up at the birthday party");
      await nv.hub.talk(nv.v.agents.find((x) => x.id === "ama")!, nv.v.agents.find((x) => x.id === "elder")!);
      expect(elder.mem.beliefs[0]).toMatchObject({ about: "Kai", source: "Ama", conf: 0.4 });
      expect(elder.mem.bonds.Kai!.why.at(-1)!.text).toContain("Ama told me: Pip told Ama: Kai stood Pip up");
    }, 20000);

    it("news reaches a mind hosted on another machine through a spoken line", () => {
      const { nv } = make();
      nv.me = "me";
      nv.setHost("mo", "me");
      nv.setHost("pip", "other");
      nv.hear({ who: "pip", say: "Kai broke a promise to me, you know.", to: "mo" });
      const mo = nv.hub.minds.get("mo")!;
      expect(mo.mem.beliefs[0]).toMatchObject({ about: "Kai", text: "broke a promise", source: "Pip" });
      expect(mo.mem.bonds.Kai!.trust).toBeLessThan(0);
    });
  });

  describe("long goals", () => {
    it("shows Pip's pet after buying it on the host", () => {
      const { nv } = make();
      expect(nv.hasPet.pip).toBe(false);
      nv.purseOf("pip").coins = 45;
      run(nv, 0.25);
      expect(nv.purseOf("pip").goals).toBe(1);
      expect(nv.hasPet.pip).toBe(true);
      expect(nv.hasPet.mo).toBe(false);
    });

    it("shows Pip's pet when a non-host hears the purchase", () => {
      const { nv } = make();
      nv.me = "me";
      nv.setHost("pip", "other");
      expect(nv.hasPet.pip).toBe(false);
      nv.hear({ who: "pip", say: "I am saving for a pet of my own." });
      expect(nv.hasPet.pip).toBe(false);
      nv.hear({ who: "pip", say: "At last! I bought a pet of my own!" });
      expect(nv.hasPet.pip).toBe(true);
      expect(nv.hub.minds.has("pip")).toBe(false);
    });

    it("restores Pip's pet from the saved purse on any machine", () => {
      for (const remote of [false, true]) {
        const { nv } = make();
        if (remote) {
          nv.me = "me";
          nv.setHost("pip", "other");
        }
        nv.setMemory("pip", ["purse|5||0||0"]);
        expect(nv.hasPet.pip).toBe(false);
        nv.setMemory("pip", ["purse|5||0||1"]);
        expect(nv.hasPet.pip).toBe(true);
      }
    });

    it("saves, buys, says so, and moves on; the count travels with the purse", () => {
      const { nv, bubbles, lines } = make();
      const pip = nv.hub.minds.get("pip")!;
      nv.purseOf("pip").coins = 50;
      run(nv, 0.5);
      expect(nv.purseOf("pip")).toMatchObject({ coins: 5, goals: 1 });
      expect(bubbles.some(([id, t]) => id === "pip" && t.includes("a pet of my own"))).toBe(true);
      expect(pip.mem.facts).toContain("saved up and bought a pet of my own");
      const held = lines.filter((l) => l.who === "pip" && l.mem?.startsWith("purse|")).at(-1)!.mem!;
      nv.setMemory("pip", [held]);
      expect(pip.mem.purse!.goals).toBe(1);
    });

    it("answers from the books and keeps its coins back in a deal", async () => {
      const { nv } = make();
      nv.pocket = { coins: () => 100, count: () => 5, change: () => {} };
      nv.purseOf("pip").coins = 30;
      expect((await nv.reply("pip", "Kai", "what are you saving for?"))?.text).toBe("I am saving for a pet of my own. 30 of 45 coins so far.");
      expect((await nv.reply("pip", "Kai", "sell you a tomato for 12 coins"))?.text).toContain("I am saving for a pet of my own");
    });
  });
});

describe("open offers", () => {
  const SPOTS2 = { ...SPOTS, playground: [{ x: 4, z: 4 }], pond: [{ x: 8, z: 8 }] };
  function ready() {
    const nv = new NpcVillage(new MindScheduler(() => null), () => false, { line: () => {}, say: () => {} }, HOMES, SPOTS2, () => true, undefined, mulberry32(5));
    nv.hub.placesOf = () => [{ name: "the lawn", words: ["lawn"], x: 0, z: 3 }, { name: "the playground", words: ["playground"], x: 4, z: 4 }];
    nv.v.t = DAY_SECONDS * 0.5; // noon
    const m = nv.hub.minds.get("pip")!;
    return { nv, m };
  }

  it("a free model line opens an offer, and yes acts on it", async () => {
    const { nv, m } = ready();
    nv.noteOffer("pip", m, "Kai", "Wanna dance?");
    expect((await nv.reply("pip", "Kai", "yes"))?.text).toMatch(/lawn/);
    expect(m.mem.promises.filter((c) => c.act === "dance" && c.state === "open")).toHaveLength(1);
  });

  it("where? follows the offer and keeps it open", async () => {
    const { nv, m } = ready();
    nv.noteOffer("pip", m, "Kai", "Wanna play soccer?");
    expect((await nv.reply("pip", "Kai", "where?"))?.text).toMatch(/playground/i);
    await nv.reply("pip", "Kai", "ok let's go");
    expect(m.mem.promises.some((c) => c.act === "soccer")).toBe(true);
  });

  it("no ends it and maybe later keeps it", async () => {
    const { nv, m } = ready();
    nv.noteOffer("pip", m, "Kai", "Wanna play soccer?");
    expect((await nv.reply("pip", "Kai", "maybe later"))?.text).toMatch(/say when/i);
    await nv.reply("pip", "Kai", "ok now");
    expect(m.mem.promises).toHaveLength(1);
    nv.noteOffer("pip", m, "Kai", "Wanna dance?");
    expect((await nv.reply("pip", "Kai", "no thanks"))?.text).toMatch(/another day/i);
    nv.noteOffer("pip", m, "Kai", "Wanna dance?");
    expect(await nv.reply("pip", "Kai", "yes")).toBeNull(); // not open again today; no model here
  });

  it("a statement or a question about fishing is no offer", () => {
    expect(offerIn("I want to fish.", 0, "noon")).toBeNull();
    expect(offerIn("Do you like fishing?", 0, "noon")).toBeNull();
    expect(offerIn("Kai, soccer this evening?", 0, "noon")?.phase).toBe("evening");
    expect(offerIn("Wanna dance?", 0, "morning")?.phase).toBe("evening"); // nobody dances in the morning
    expect(answerTo("maybe later")).toBe("later");
    expect(answerTo("yep!")).toBe("yes");
    expect(answerTo("nah")).toBe("no");
    expect(answerTo("what bait?")).toBeNull();
  });
});

describe("free talk tiers", () => {
  const village = (lm: { label: string; ready: () => boolean; complete: () => Promise<string> } | null) => {
    const nv = new NpcVillage(new MindScheduler(() => lm, { duty: 1 }), () => !!lm, { line: () => {}, say: () => {} }, HOMES, SPOTS, () => true);
    nv.me = "me";
    nv.setHost("mo", "me");
    return nv;
  };
  const local = { label: "fake 1B", ready: () => true, complete: async () => "The local line." };

  it("asks the cloud first, with no local model needed, and it sees the talk so far", async () => {
    const nv = village(null);
    const minds: string[] = [];
    nv.cloud = async (_n, _l, _s, mind) => (minds.push(mind), { text: "A big fish, nice.", source: "model" });
    expect((await nv.reply("mo", "Kai", "I caught a big fish today"))?.source).toBe("model");
    await nv.reply("mo", "Kai", "what do you think of it?");
    expect(minds[1]).toContain("Kai: I caught a big fish today");
    expect(minds[1]).toContain("A big fish, nice.");
  });

  it("tells the cloud the time and what the villager is doing", async () => {
    const nv = village(null);
    const minds: string[] = [];
    nv.cloud = async (_n, _l, _s, mind) => (minds.push(mind), { text: "Evening, Kai.", source: "model" });
    await nv.reply("mo", "Kai", "nice weather");
    expect(minds[0]).toMatch(/^Right now it is \d\d:\d\d, (morning|noon|evening|night), and you are /);
  });

  it("greets a walking-up player through the cloud, and the greeting joins the talk", async () => {
    const nv = village(null);
    const asked: { line: string; mind: string }[] = [];
    nv.cloud = async (_n, line, _s, mind) => (asked.push({ line, mind }), { text: "Oh hey, Kai. Fish are slow today.", source: "model" });
    const a = nv.v.agents.find((x) => x.id === "mo")!;
    nv.people = () => [{ id: "me", name: "Kai", pos: a.pos }];
    Object.assign(a, { state: "idle", act: null, idle: 5, gather: null });
    nv.step(0.25, nv.v.t + 0.25);
    await new Promise((r) => setTimeout(r, 0));
    expect(asked[0]).toMatchObject({ line: "" });
    expect(asked[0]!.mind).toContain("Kai just walked up to you.");
    await nv.reply("mo", "Kai", "slow?");
    expect(asked[1]!.mind).toContain("Mo: Oh hey, Kai. Fish are slow today.");
  });

  it("drops to the local model when the cloud gives nothing", async () => {
    const nv = village(local);
    nv.cloud = async () => null;
    expect((await nv.reply("mo", "Kai", "nice weather"))?.text).toContain("local line");
  });

  it("never asks the cloud what the sim knows", async () => {
    const nv = village(local);
    let asked = 0;
    nv.cloud = async () => (asked++, null);
    await nv.reply("mo", "Kai", "My name is Kai");
    await nv.reply("mo", "Kai", "what is my name?");
    expect(asked).toBe(1);
  });
});

describe("a player's own offer", () => {
  it("is an invitation, and it replaces what the villager had asked", async () => {
    const nv = new NpcVillage(new MindScheduler(() => null, { duty: 1 }), () => false, { line: () => {}, say: () => {} }, HOMES, SPOTS, () => true);
    nv.me = "me";
    nv.setHost("pip", "me");
    nv.noteOffer("pip", nv.hub.minds.get("pip")!, "Kai", "Wanna play soccer?");
    const r = await nv.reply("pip", "Kai", "Wanna dance?");
    expect(r?.source).toBe("rules");
    expect(r?.text).toMatch(/danc/i);
    expect(nv.hub.minds.get("pip")!.mem.promises.map((c) => c.act)).toEqual(["dance"]);
  });
});
