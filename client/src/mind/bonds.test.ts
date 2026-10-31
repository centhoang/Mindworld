import { describe, expect, it } from "vitest";
import { addBelief, beliefFrom, beliefLine, bondLine, bondOf, bondText, feel, feelWord, gossipFrom, parseBeliefLine, parseBondLine, toneOf, wariness, whyAnswer } from "./bonds";
import { emptyMemory, parseMemory, relevant, remember, LOG_MAX } from "./memory";
import { VILLAGERS, type Persona } from "./persona";

const by = (id: string): Persona => VILLAGERS.find((p) => p.id === id)!;
const pip = by("pip"), mo = by("mo"), ama = by("ama");
const STOOD = "Kai stood me up at the birthday party";

describe("feel", () => {
  it("ties every change to a reason", () => {
    const m = emptyMemory();
    feel(m, pip, "Kai", "broken", 2, STOOD);
    const b = bondOf(m, "Kai")!;
    expect(b.trust).toBeLessThan(0);
    expect(b.why).toEqual([{ day: 2, beat: "broken", text: STOOD }]);
  });
  it("weighs a beat by who the mind is", () => {
    const [a, b] = [emptyMemory(), emptyMemory()];
    expect(Math.abs(feel(a, pip, "Kai", "broken", 0, "x"))).toBeGreaterThan(Math.abs(feel(b, mo, "Kai", "broken", 0, "x")));
    expect(a.bonds.Kai!.trust).toBeLessThan(b.bonds.Kai!.trust);
  });
  it("keeps few reasons and stays in range", () => {
    const m = emptyMemory();
    for (let i = 0; i < 20; i++) feel(m, pip, "Kai", "broken", i, `reason ${i}`);
    expect(m.bonds.Kai!.why).toHaveLength(4);
    expect(m.bonds.Kai!.trust).toBe(-100);
  });
  it("makes a broken promise cost a later yes", () => {
    const m = emptyMemory();
    expect(wariness(undefined)).toBe(0);
    feel(m, pip, "Kai", "broken", 0, STOOD);
    expect(wariness(m.bonds.Kai)).toBeLessThan(0);
    expect(feelWord(m.bonds.Kai!)).toBe("wary of");
  });
});

describe("why", () => {
  const hurtMem = () => {
    const m = emptyMemory();
    feel(m, pip, "Kai", "broken", 0, STOOD);
    return m;
  };
  it("answers from the real reason, said to the person", () => {
    expect(whyAnswer("why are you mad at me?", hurtMem().bonds.Kai, "Kai")).toBe("Because you stood me up at the birthday party.");
    expect(whyAnswer("Why don’t you like me", hurtMem().bonds.Kai, "Kai")).toContain("stood me up");
  });
  it("has nothing to invent when nothing happened", () => {
    expect(whyAnswer("are you mad?", undefined, "Kai")).toBe("I am not upset with you, Kai.");
    expect(whyAnswer("why do you like me?", undefined, "Kai")).toBeNull();
    expect(whyAnswer("nice weather", hurtMem().bonds.Kai, "Kai")).toBeNull();
  });
  it("gives the prompt the feeling, and nothing when there is none", () => {
    expect(bondText(emptyMemory(), "Kai")).toBe("");
    expect(bondText(hurtMem(), "Kai")).toBe(`You feel wary of Kai: ${STOOD}.`);
  });
});

describe("beliefs and tone", () => {
  it("reads what a player says about themselves", () => {
    expect(beliefFrom("I love carrots!")).toBe("likes carrots");
    expect(beliefFrom("my favorite food is pumpkin soup")).toBe("likes pumpkin soup");
    expect(beliefFrom("I don’t like rain")).toBe("dislikes rain");
    expect(beliefFrom("I like you")).toBeNull();
    expect(beliefFrom("hello there")).toBeNull();
  });
  it("hears kindness and rudeness", () => {
    expect(toneOf("thank you so much")).toBe("kind");
    expect(toneOf("shut up, you are annoying")).toBe("rude");
    expect(toneOf("what time is it")).toBeNull();
    expect(toneOf("I am so sorry")).toBe("sorry");
  });
  it("hearing a belief twice raises confidence, and first hand wins over hearsay", () => {
    const m = emptyMemory();
    const b = { about: "Kai", text: "likes carrots", source: "Mo", conf: 0.5, day: 0 };
    expect(addBelief(m, b)).toBe(true);
    expect(addBelief(m, { ...b, source: "" })).toBe(false);
    expect(m.beliefs).toHaveLength(1);
    expect(m.beliefs[0]!.conf).toBeCloseTo(0.7);
    expect(m.beliefs[0]!.source).toBe("");
  });
});

describe("gossip", () => {
  it("passes on a broken promise, by personality", () => {
    const m = emptyMemory();
    feel(m, pip, "Kai", "broken", 0, STOOD);
    expect(gossipFrom(m, pip, "Mo")).toEqual({ about: "Kai", text: STOOD });
    expect(gossipFrom(m, mo, "Pip")).toBeNull();
    expect(gossipFrom(m, ama, "Kai")).toBeNull();
    expect(gossipFrom(emptyMemory(), pip, "Mo")).toBeNull();
  });
});

describe("wire", () => {
  it("bond and belief lines fit the room log and come back", () => {
    const m = emptyMemory();
    feel(m, pip, "Kai", "broken", 3, `${STOOD} and a very long tail that goes on and on and on and on and on`);
    const line = bondLine("Kai", m.bonds.Kai!);
    expect(line.length).toBeLessThanOrEqual(120);
    const back = parseBondLine(line, 3)!;
    expect(back.who).toBe("Kai");
    expect(back.bond.trust).toBe(m.bonds.Kai!.trust);
    expect(back.bond.why[0]!.beat).toBe("broken");
    const b = { about: "Kai", text: "likes carrots", source: "Mo", conf: 0.5, day: 3 };
    expect(parseBeliefLine(beliefLine(b), 3)).toEqual(b);
    expect(parseBondLine("08:10 ate", 0)).toBeNull();
    expect(parseBondLine("bond|Kai|x|0|0||", 0)).toBeNull();
    expect(parseBeliefLine("belief|Kai", 0)).toBeNull();
  });
  it("saves survive a reload, and old saves load empty", () => {
    const m = emptyMemory();
    feel(m, pip, "Kai", "kind", 0, "Kai thanked me");
    addBelief(m, { about: "Kai", text: "likes carrots", source: "", conf: 0.8, day: 0 });
    m.why = "x > y";
    const back = parseMemory(JSON.parse(JSON.stringify(m)));
    expect(back.bonds.Kai!.why).toHaveLength(1);
    expect(back.beliefs).toHaveLength(1);
    expect(back.why).toBe("x > y");
    expect(parseMemory({ log: [] }).bonds).toEqual({});
  });
});

describe("memory v2", () => {
  it("keeps the important past when the log is full", () => {
    const m = emptyMemory();
    remember(m, 0, "08:00", STOOD, 8);
    for (let i = 0; i < LOG_MAX + 5; i++) remember(m, 0, "09:00", `ate ${i}`);
    expect(m.log).toHaveLength(LOG_MAX);
    expect(m.log[0]!.text).toBe(STOOD);
  });
  it("finds short names, and prefers what mattered", () => {
    const m = emptyMemory();
    remember(m, 0, "08:00", "saw Mo fishing");
    remember(m, 0, "09:00", "ate lunch");
    expect(relevant(m, "hello", 1, "Mo")[0]!.text).toBe("saw Mo fishing");
    remember(m, 0, "10:00", "Kai danced with me", 8);
    remember(m, 0, "11:00", "Kai walked past");
    expect(relevant(m, "hello", 1, "Kai")[0]!.text).toBe("Kai danced with me");
  });
});
