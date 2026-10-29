import { describe, expect, it } from "vitest";
import { mulberry32 } from "../sim/rng";
import { addAgent, newVillage, stepVillage, type Env } from "../life/village";
import { fullNeeds } from "../life/needs";
import { choosePrompt, eventText, parseChoice, parseEmote, parseLine, parsePlan, planPrompt } from "./brain";
import { MindHub, parseMindsSave } from "./hub";
import { addFact, emptyMemory, FACTS_MAX, LOG_MAX, relevant, remember } from "./memory";
import { petPersona, traitBias, VILLAGERS } from "./persona";
import { MindScheduler, PRIO, type MindLM } from "./scheduler";

const GENES = { hue: 0.2, accent: 0.7, ears: 0.1, tail: 0.9, build: 0.2, pattern: 0.4 };
const flush = () => new Promise((r) => setTimeout(r, 0));

// A fake model: answers with `reply(user prompt)` after `ms`.
function fakeLM(reply: (user: string) => string, ms = 0): MindLM & { calls: string[] } {
  const calls: string[] = [];
  return {
    label: "fake 1B",
    calls,
    ready: () => true,
    complete: async (req) => {
      calls.push(req.user);
      if (ms) await new Promise((r) => setTimeout(r, ms));
      return reply(req.user);
    },
  };
}

describe("persona", () => {
  it("is derived from genes: stable, varied, and biases the sim", () => {
    const a = petPersona("Mallow", GENES);
    expect(petPersona("Mallow", GENES)).toEqual(a);
    expect(a.traits).toHaveLength(3);
    expect(new Set(a.traits).size).toBe(3);
    const b = petPersona("Sprig", { ...GENES, ears: 0.6, hue: 0.9 });
    expect(b.traits.join()).not.toBe(a.traits.join());
    const playful = { ...a, traits: ["playful"] };
    expect(traitBias(playful, "ball")).toBeGreaterThan(0);
    expect(VILLAGERS.map((v) => v.id)).toContain("elder");
  });
});

describe("memory", () => {
  it("keeps a capped log without repeats and a few facts", () => {
    const m = emptyMemory();
    for (let i = 0; i < LOG_MAX + 5; i++) remember(m, 0, "08:00", `did thing ${i}`);
    remember(m, 0, "08:00", `did thing ${LOG_MAX + 4}`);
    expect(m.log).toHaveLength(LOG_MAX);
    for (let i = 0; i < FACTS_MAX + 2; i++) addFact(m, `fact ${i}`);
    expect(m.facts).toHaveLength(FACTS_MAX);
    expect(m.facts[0]).toBe("fact 2");
  });
  it("finds memories by topic words", () => {
    const m = emptyMemory();
    remember(m, 0, "08:00", "ate at the bowl");
    remember(m, 0, "09:00", "played ball with Sprig");
    remember(m, 0, "10:00", "took a nap");
    expect(relevant(m, "ball game Sprig", 2)[0]!.text).toBe("played ball with Sprig");
  });
});

describe("brain", () => {
  it("builds grammar-constrained prompts and rejects answers outside the set", () => {
    const p = petPersona("Mallow", GENES);
    const req = choosePrompt(p, emptyMemory(), fullNeeds(), "morning", ["eat", "ball"], "");
    expect(req.grammar).toBe('root ::= "eat" | "ball"');
    expect(req.user).toContain("Mallow");
    expect(parseChoice(" ball\n", ["eat", "ball"])).toBe("ball");
    expect(parseChoice("fish", ["eat", "ball"])).toBeNull();
    expect(planPrompt(p, emptyMemory(), ["eat", "nap"]).grammar).toContain('act ::= "eat" | "nap"');
    expect(parsePlan("eat, nap,eat", ["eat", "nap"])).toEqual({ morning: ["eat"], noon: ["nap"], evening: ["eat"] });
    expect(parsePlan("eat,fly,eat", ["eat", "nap"])).toBeNull();
    expect(parseEmote("wave")).toBe("wave");
    expect(parseEmote("shrug")).toBeNull();
  });
  it("cleans lines: no speaker prefix, no emoji, clipped", () => {
    expect(parseLine('"Mallow: Hi Sprig! 🎉 Want to play?"', "Mallow")).toBe("Hi Sprig! Want to play?");
    expect(parseLine("x".repeat(200), "A")!.length).toBeLessThanOrEqual(90);
    expect(parseLine("🎉", "A")).toBeNull();
    expect(eventText("ball", ["Sprig"])).toBe("played ball with Sprig");
  });
});

describe("scheduler", () => {
  it("answers with the fallback at once when there is no model", async () => {
    const s = new MindScheduler(() => null);
    const a = await s.ask({ prio: 1, timeoutMs: 100, req: { system: "", user: "", maxTokens: 1, temperature: 0 }, parse: () => "model", fallback: () => "rules" });
    expect(a).toEqual({ value: "rules", source: "rules" });
  });
  it("runs one job at a time, highest priority first, and labels the source", async () => {
    const lm = fakeLM((u) => u, 5);
    const s = new MindScheduler(() => lm, { duty: 1 });
    const req = (user: string) => ({ system: "", user, maxTokens: 1, temperature: 0 });
    const first = s.ask({ prio: PRIO.plan, timeoutMs: 1000, req: req("plan"), parse: (t) => t, fallback: () => "x" });
    const low = s.ask({ prio: PRIO.plan, timeoutMs: 1000, req: req("plan2"), parse: (t) => t, fallback: () => "x" });
    const high = s.ask({ prio: PRIO.talk, timeoutMs: 1000, req: req("talk"), parse: (t) => t, fallback: () => "x" });
    expect((await first).source).toBe("fake 1B");
    await Promise.all([low, high]);
    expect(lm.calls).toEqual(["plan", "talk", "plan2"]);
  });
  it("falls back when the model is too slow or answers nonsense", async () => {
    const s = new MindScheduler(() => fakeLM(() => "???", 50), { duty: 1 });
    const slow = await s.ask({ prio: 1, timeoutMs: 10, req: { system: "", user: "", maxTokens: 1, temperature: 0 }, parse: (t) => t, fallback: () => "late" });
    expect(slow.value).toBe("late");
    const bad = await s.ask({ prio: 1, timeoutMs: 500, req: { system: "", user: "", maxTokens: 1, temperature: 0 }, parse: () => null, fallback: () => "rules" });
    expect(bad).toEqual({ value: "rules", source: "rules" });
  });
  it("measures the model's speed for the host heartbeat", async () => {
    let t = 0;
    const lm = { label: "fake", ready: () => true, complete: async () => ((t += 1000), "x".repeat(80)) }; // 20 tokens in 1 s
    const s = new MindScheduler(() => lm, { duty: 1, now: () => t });
    expect(s.tps(12)).toBe(12);
    await s.ask({ prio: 1, timeoutMs: 1e9, req: { system: "", user: "", maxTokens: 30, temperature: 0 }, parse: (x) => x, fallback: () => "" });
    expect(s.tps(12)).toBe(20);
  });
});

describe("mind hub + sim", () => {
  const SPOTS = { home: [{ x: 0, z: 0 }], bowl: [{ x: 3, z: 0 }], bed: [{ x: -3, z: 0 }], lawn: [{ x: 0, z: 3 }] };

  it("the model's pick (from the valid choices) drives the agent", async () => {
    const v = newVillage();
    const a = addAgent(v, "Mallow", "Mallow", "pet", { x: 0, z: 0 }, { ...fullNeeds(), hunger: 30, energy: 40 });
    const lm = fakeLM((u) => (u.includes("Options:") ? "nap" : "eat,nap,groom"));
    const hub = new MindHub(v, new MindScheduler(() => lm, { duty: 1 }), { say: () => undefined }, () => true);
    hub.add(petPersona("Mallow", GENES));
    const env: Env = { spots: SPOTS, canWalk: () => true, rng: mulberry32(1), chooser: hub.chooser, bias: hub.bias };
    for (let i = 0; i < 20 && a.act === null; i++) {
      hub.onEvents(stepVillage(v, 0.5, env));
      hub.tick();
      await flush();
    }
    expect(a.act).toBe("nap");
    expect(hub.minds.get("Mallow")!.source).toBe("fake 1B");
    expect(lm.calls.some((c) => c.includes("Options:"))).toBe(true);
  });

  it("two minds that meet talk, remember it, and an invitation spreads", async () => {
    const v = newVillage();
    const a = addAgent(v, "Mallow", "Mallow", "pet", { x: 0, z: 0 }, { ...fullNeeds(), social: 20 });
    const b = addAgent(v, "Sprig", "Sprig", "pet", { x: 1, z: 0 }, { ...fullNeeds(), social: 20 });
    const lm = fakeLM(() => "Want to dance tonight?");
    const said: string[] = [];
    const invited: [string, string][] = [];
    const hub = new MindHub(v, new MindScheduler(() => lm, { duty: 1 }), { say: (id, t) => t !== "..." && said.push(`${id}: ${t}`), invite: (id, act) => void invited.push([id, act]) }, () => true);
    const ma = hub.add(petPersona("Mallow", GENES));
    hub.add(petPersona("Sprig", { ...GENES, ears: 0.7 }));
    ma.mem.plan = { evening: ["dance"] };
    ma.mem.planDay = hub.minds.get("Sprig")!.mem.planDay = 0;
    await hub.talk(a, b);
    expect(said.length).toBeGreaterThanOrEqual(2);
    expect(said[0]).toBe("Mallow: Want to dance tonight?");
    expect(hub.minds.get("Sprig")!.mem.plan.evening).toContain("dance");
    expect(b.plan.evening).toContain("dance");
    expect(hub.minds.get("Sprig")!.mem.log.map((e) => e.text).join()).toMatch(/invited me to dance/);
    expect(v.rel.size).toBe(1);
    expect(invited).toEqual([["Mallow", "dance"]]);
  });

  it("saves and parses defensively", () => {
    const v = newVillage();
    addAgent(v, "Mallow", "Mallow", "pet", { x: 0, z: 0 });
    const hub = new MindHub(v, new MindScheduler(() => null), { say: () => undefined }, () => false);
    hub.add(petPersona("Mallow", GENES));
    remember(hub.minds.get("Mallow")!.mem, 0, "08:00", "woke up");
    const back = parseMindsSave(JSON.parse(JSON.stringify(hub.snapshot())));
    expect(back!.minds.Mallow!.mem.log[0]!.text).toBe("woke up");
    expect(parseMindsSave("junk")).toBeNull();
    expect(parseMindsSave({ t: -5, rel: [[1, 2]], minds: { x: { needs: { hunger: 900 } } } })).toMatchObject({ t: 0, rel: [], minds: { x: { needs: { hunger: 100 } } } });
  });
});

describe("invitations from other players", () => {
  it("puts a remote group invitation into one of my minds' next plan, once, and ignores solo acts", () => {
    const v = newVillage();
    addAgent(v, "Mallow", "Mallow", "pet", { x: 0, z: 0 }, fullNeeds());
    addAgent(v, "Sprig", "Sprig", "pet", { x: 1, z: 0 }, fullNeeds());
    const hub = new MindHub(v, new MindScheduler(() => null), { say: () => undefined }, () => false);
    hub.add(petPersona("Mallow", GENES));
    hub.add(petPersona("Sprig", { ...GENES, hue: 0.8 }));
    const first = hub.heardInvite("Pip", "picnic");
    const second = hub.heardInvite("Pip", "picnic");
    expect(first).not.toBeNull();
    expect(second).not.toBe(first);
    expect(hub.heardInvite("Pip", "picnic")).toBeNull(); // both have it now
    expect(hub.heardInvite("Pip", "nap")).toBeNull();
    expect(hub.heardInvite("Pip", "steal")).toBeNull();
    const m = hub.minds.get(first!)!;
    expect(Object.values(m.mem.plan).flat()).toContain("picnic");
    expect(m.mem.log.at(-1)!.text).toMatch(/Pip from next door invited me to picnic/);
    expect(v.agents.find((a) => a.id === first)!.plan).toBe(m.mem.plan);
  });
});
