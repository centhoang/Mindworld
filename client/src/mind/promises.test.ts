import { describe, expect, it } from "vitest";
import type { Phase } from "../life/clock";
import { emptyMemory, remember } from "./memory";
import { VILLAGERS, type Persona } from "./persona";
import {
  addCommitment, decidePrompt, dueNow, extractPrompt, extractRules, inviteScore, missed,
  outcomeAffinity, outcomeMemory, parseDecision, parseExtract, ruleDecision, settle,
  type Commitment, type Invite,
} from "./promises";

const person = (changes: Partial<Persona> = {}): Persona => ({
  id: "pip", name: "Pip", kind: "human", traits: [], hobbies: [],
  habit: "waves to friends", background: "Lives in the village.", ...changes,
});
const promise = (changes: Partial<Commitment> = {}): Commitment => ({
  id: "party-1", from: "Kai", fromId: "player-kai", act: "dance", occasion: "birthday party",
  day: 4, phase: "evening", state: "open", importance: 5, ...changes,
});
const calendar = (): Commitment[] => Array.from({ length: 8 }, (_, i) =>
  promise({ id: `c${i}`, fromId: `player-${i}`, importance: i + 1 }));

describe("rule invitation extraction", () => {
  const examples: [string, Invite][] = [
    ["my birthday party is tomorrow evening at the playground, come?", { act: "dance", occasion: "birthday party", day: 5, phase: "evening" }],
    ["Come dance", { act: "dance", occasion: "", day: 4, phase: "evening" }],
    ["Join me for soccer today morning", { act: "soccer", occasion: "", day: 4, phase: "morning" }],
    ["Football tomorrow noon?", { act: "soccer", occasion: "", day: 5, phase: "noon" }],
    ["Can you fish tomorrow morning?", { act: "fish", occasion: "", day: 5, phase: "morning" }],
    ["Come to the party", { act: "dance", occasion: "party", day: 4, phase: "evening" }],
    ["LET’S GO DANCING TONIGHT!", { act: "dance", occasion: "", day: 4, phase: "evening" }],
    ["Soccer today?", { act: "soccer", occasion: "", day: 4, phase: "evening" }],
    ["Fishing in the morning?", { act: "fish", occasion: "", day: 4, phase: "morning" }],
    ["Come to my birthday tomorrow", { act: "dance", occasion: "birthday", day: 5, phase: "evening" }],
    ["Want   to\nfish?", { act: "fish", occasion: "", day: 4, phase: "evening" }],
  ];
  it("has no picnics: the pack cannot show a person sitting", () => {
    expect(extractRules("want to have a picnic today?", 4)).toBeNull();
  });

  it.each(examples)("extracts %s", (line, expected) => {
    expect(extractRules(line, 4)).toEqual(expected);
  });

  it.each([
    "", "hello", "We had a party yesterday.", "I went fishing this morning.",
    "I like soccer.", "Soccer tomorrow", "Soccer?", "Did you fish this morning?",
    "Did you come to the party yesterday?", "Come to the party last night",
    "We used to come dancing years ago.", "Don't come to the party tomorrow",
    "Let's not play soccer tomorrow", "I do not want to fish tomorrow",
    "Come code tomorrow?", "Join these selfish people tomorrow?", "Footballer tomorrow?",
  ])("rejects non-invitation %j", (line) => {
    expect(extractRules(line, 4)).toBeNull();
  });

  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects invalid today %s", (today) => {
    expect(extractRules("Come fish tomorrow", today)).toBeNull();
  });
  it("accepts day zero and rejects tomorrow overflow", () => {
    expect(extractRules("Come fish today", 0)?.day).toBe(0);
    expect(extractRules("Come fish tomorrow", Number.MAX_SAFE_INTEGER)).toBeNull();
  });
});

describe("model invitation extraction", () => {
  it("constrains every field with GBNF and keeps even a long message under 90 words", () => {
    const req = extractPrompt("Come to my birthday party tomorrow evening?");
    expect(req.grammar).toBe('root ::= "none" | act "," day "," phase\nact ::= "dance" | "soccer" | "fish" | "picnic"\nday ::= "today" | "tomorrow"\nphase ::= "morning" | "noon" | "evening"');
    expect(req.user).toContain("birthday party tomorrow evening");
    expect(req.user).toContain("tonight=today,evening");
    expect(req.user).toContain("never a past event or plain statement");
    expect(req.maxTokens).toBeLessThanOrEqual(20);
    const long = extractPrompt("x ".repeat(1000));
    expect(`${long.system} ${long.user}`.trim().split(/\s+/).length).toBeLessThan(90);
    expect(long.user).not.toContain("\n\n");
  });

  const answers = ["dance", "soccer", "fish"].flatMap((act) =>
    ["today", "tomorrow"].flatMap((day) =>
      (["morning", "noon", "evening"] as const).map((phase) => ({ act, day, phase }))));
  it.each(answers)("parses $act,$day,$phase", ({ act, day, phase }) => {
    expect(parseExtract(`${act},${day},${phase}`, 4)).toEqual({
      act, occasion: "", day: day === "tomorrow" ? 5 : 4, phase,
    });
  });
  it("tolerates casing and surrounding whitespace", () => {
    expect(parseExtract("  SOCCER, tomorrow, NOON\n", 0)).toEqual({ act: "soccer", occasion: "", day: 1, phase: "noon" });
  });
  it.each([
    "none", "", "dance", "party,today,evening", "cook,today,noon", "dance,yesterday,evening",
    "soccer,5,noon", "fish,tomorrow,night", "picnic,today,evening", "dance,today",
    "dance,today,evening,extra", "dance,today,evening\nI will come", '"dance,today,evening"',
    "none,today,evening", "```dance,today,evening```",
  ])("rejects %j", (text) => {
    expect(parseExtract(text, 4)).toBeNull();
  });
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects invalid day %s", (today) => {
    expect(parseExtract("fish,today,morning", today)).toBeNull();
  });
  it("rejects tomorrow overflow", () => {
    expect(parseExtract("fish,tomorrow,morning", Number.MAX_SAFE_INTEGER)).toBeNull();
  });
});

describe("willingness", () => {
  it("starts at 0.5 and adds affinity divided by 200", () => {
    expect(inviteScore(person(), 0, "soccer", 0)).toBe(0.5);
    expect(inviteScore(person(), 40, "soccer", 0)).toBeCloseTo(0.7);
    expect(inviteScore(person(), -40, "soccer", 0)).toBeCloseTo(0.3);
  });
  it.each([
    ["dance", ["dancing"]], ["dance", ["DANCES"]], ["soccer", ["playing soccer"]],
    ["fish", ["fishing"]], ["picnic", ["picnicking"]],
  ])("recognizes hobby words for %s", (act, hobbies) => {
    expect(inviteScore(person({ hobbies }), 0, act, 0)).toBe(0.75);
  });
  it("gives one hobby bonus and does not mistake selfish for fishing", () => {
    expect(inviteScore(person({ hobbies: ["fish", "fishing"] }), 0, "fish", 0)).toBe(0.75);
    expect(inviteScore(person({ hobbies: ["selfish games"] }), 0, "fish", 0)).toBe(0.5);
    expect(inviteScore(person({ hobbies: ["playing piano"] }), 0, "soccer", 0)).toBe(0.5);
  });
  it("adds trait bias and charges 0.3 for each conflict", () => {
    const p = person({ traits: ["playful"], hobbies: ["dancing"] });
    expect(inviteScore(p, 0, "dance", 1)).toBeCloseTo(0.65);
    expect(inviteScore(p, 0, "dance", 2)).toBeCloseTo(0.35);
    expect(inviteScore(person({ traits: ["grumpy"] }), 0, "dance", 0)).toBeCloseTo(0.3);
  });
  it("clamps willingness and never rewards a negative conflict count", () => {
    expect(inviteScore(person(), 1000, "dance", 0)).toBe(1);
    expect(inviteScore(person(), -1000, "dance", 0)).toBe(0);
    expect(inviteScore(person(), 0, "dance", 10)).toBe(0);
    expect(inviteScore(person(), 0, "dance", -2)).toBe(0.5);
    expect(inviteScore(person(), NaN, "dance", 0)).toBe(0);
    expect(inviteScore(person(), 0, "unknown", 0)).toBe(0.5);
  });
  it("makes the authored Pip keen to dance and Mo keen to fish", () => {
    expect(inviteScore(VILLAGERS.find((p) => p.id === "pip")!, 0, "dance", 0)).toBe(1);
    expect(inviteScore(VILLAGERS.find((p) => p.id === "mo")!, 0, "fish", 0)).toBe(1);
  });
});

describe("invitation decisions", () => {
  it.each([[0.67, "keen"], [0.66, "unsure"], [0.5, "unsure"], [0.33, "unsure"], [0.32, "reluctant"]] as const)(
    "grounds score %s in the feeling %s", (score, feel) => {
      const req = decidePrompt(person(), emptyMemory(), promise(), "Kai", score, ["tired", "happy"]);
      expect(req.user).toContain(`Willingness ${score.toFixed(2)}: ${feel}.`);
      expect(req.user).toContain("Mood: tired, happy");
      expect(req.user).toContain("Kai invites you to birthday party (dance), day 4 evening");
      expect(req.grammar).toBe('root ::= "accept" | "decline" | "counter"');
      expect(req.maxTokens).toBeLessThanOrEqual(8);
    },
  );
  it("uses personality and one relevant memory, without changing either", () => {
    const p = person({ traits: ["playful"], hobbies: ["dancing"] });
    const m = emptyMemory();
    remember(m, 1, "18:00", "Kai came to the birthday party");
    remember(m, 2, "09:00", "Ate alone");
    const before = structuredClone({ p, m });
    const req = decidePrompt(p, m, promise(), "Kai", 0.8, "excited");
    expect(req.user).toContain("playful");
    expect(req.user).toContain("dancing");
    expect(req.user).toContain("Kai came to the birthday party");
    expect(req.user).not.toContain("Ate alone");
    expect({ p, m }).toEqual(before);
  });
  it("uses a fact or recent memory when none matches, and handles an empty memory", () => {
    const m = emptyMemory();
    remember(m, 1, "09:00", "Ate alone");
    expect(decidePrompt(person(), m, promise(), "Kai", 0.5).user).toContain("Ate alone");
    m.facts.push("Likes sharing food");
    expect(decidePrompt(person(), m, promise(), "Kai", 0.5).user).toContain("Likes sharing food");
    expect(decidePrompt(person(), emptyMemory(), promise(), "Kai", 0.5).user).toContain("Mood: steady. Memory: none");
  });
  it("bounds long context and keeps it on one line per field", () => {
    const m = emptyMemory();
    m.facts.push("memory ".repeat(1000));
    const req = decidePrompt(person({ name: "name ".repeat(1000) }), m,
      promise({ occasion: "party ".repeat(1000) }), "Kai\n".repeat(1000), 5, "happy\n".repeat(1000));
    expect(req.user.length).toBeLessThan(600);
    expect(req.user).toContain("Willingness 1.00: keen");
  });
  it.each(["accept", "decline", "counter"] as const)("parses %s", (answer) => {
    expect(parseDecision(` ${answer.toUpperCase()}\n`)).toBe(answer);
  });
  it.each(["", "yes", "accept please", "counter offer", "accept,decline", '"accept"'])("rejects %j", (answer) => {
    expect(parseDecision(answer)).toBeNull();
  });
  it.each([
    [1, "accept"], [0.55, "accept"], [0.54999, "counter"], [0.35, "counter"],
    [0.34999, "decline"], [0, "decline"], [NaN, "decline"],
  ] as const)("falls back at score %s to %s", (score, expected) => {
    expect(ruleDecision(score)).toBe(expected);
  });
});

describe("promise calendar", () => {
  it("returns only open promises due in the exact day and phase", () => {
    const due = promise();
    const list = Object.freeze([
      due, promise({ id: "morning", phase: "morning" }), promise({ id: "later", day: 5 }),
      ...(["kept", "broken", "cancelled"] as const).map((state) => promise({ id: state, state })),
    ]);
    expect(dueNow(list, 4, "evening")).toEqual([due]);
    expect(dueNow(list, 3, "evening")).toEqual([]);
    expect(dueNow([], 4, "evening")).toEqual([]);
  });
  it("adds a copied promise without mutating the input calendar", () => {
    const c = Object.freeze(promise());
    const list = Object.freeze([] as Commitment[]);
    const next = addCommitment(list, c);
    expect(next).toEqual([c]);
    expect(next[0]).not.toBe(c);
    expect(list).toEqual([]);
  });
  it("deduplicates the activity, time and inviter even when the ID changes", () => {
    const c = promise();
    expect(addCommitment([c], promise({ id: "repeat" }))).toEqual([c]);
    expect(addCommitment([c], promise({ id: c.id, act: "soccer" }))).toEqual([c]);
    expect(addCommitment([promise({ state: "kept" })], promise({ id: "repeat" }))).toEqual([promise({ state: "kept" })]);
  });
  const differentInvites: Partial<Commitment>[] = [{ act: "soccer" }, { day: 5 }, { phase: "noon" }, { fromId: "other-kai" }];
  it.each(differentInvites)("allows an invitation with a different tuple field: %j", (changes) => {
    expect(addCommitment([promise()], promise({ id: "different", ...changes }))).toHaveLength(2);
  });
  it("drops the least important open promise, keeping history and input order", () => {
    const open = calendar();
    const history = promise({ id: "history", fromId: "old", state: "broken", importance: 1 });
    const list = Object.freeze([history, ...open]);
    const next = addCommitment(list, promise({ id: "new", fromId: "new", importance: 10 }));
    expect(next.map((c) => c.id)).toEqual(["history", "c1", "c2", "c3", "c4", "c5", "c6", "c7", "new"]);
    expect(next.filter((c) => c.state === "open")).toHaveLength(8);
    expect(list).toEqual([history, ...open]);
  });
  it("drops an incoming promise if it has the lowest importance", () => {
    const list = calendar().map((c) => ({ ...c, importance: c.importance + 1 }));
    expect(addCommitment(list, promise({ id: "weak", fromId: "new", importance: 1 }))).toEqual(list);
  });
  it("drops the oldest promise on an importance tie", () => {
    const list = calendar().map((c) => ({ ...c, importance: 5 }));
    expect(addCommitment(list, promise({ id: "new", fromId: "new" })).map((c) => c.id))
      .toEqual(["c1", "c2", "c3", "c4", "c5", "c6", "c7", "new"]);
  });
  it("does not count settled promises against the eight open slots", () => {
    const next = addCommitment(calendar(), promise({ id: "past", fromId: "old", state: "kept" }));
    expect(next).toHaveLength(9);
    expect(next.filter((c) => c.state === "open")).toHaveLength(8);
  });
  it("bounds the occasion and importance without changing the supplied promise", () => {
    const c = promise({ occasion: "birthday ".repeat(20), importance: 100 });
    const saved = addCommitment([], c)[0]!;
    expect(saved.occasion.length).toBeLessThanOrEqual(30);
    expect(saved.importance).toBe(10);
    expect(c.importance).toBe(100);
    expect(addCommitment([], promise({ importance: -2 }))[0]!.importance).toBe(1);
    expect(addCommitment([], promise({ importance: NaN }))[0]!.importance).toBe(1);
  });
  const invalid: Partial<Commitment>[] = [
    { id: " " }, { from: "" }, { fromId: " " }, { act: "fly" }, { day: -1 }, { day: 1.5 },
    { day: NaN }, { phase: "afternoon" as Phase }, { state: "pending" as Commitment["state"] },
  ];
  it.each(invalid)("ignores an invalid commitment %j", (changes) => {
    expect(addCommitment([], promise(changes))).toEqual([]);
  });
  it.each(["kept", "broken", "cancelled"] as const)("settles an open promise as %s", (state) => {
    const c = Object.freeze(promise());
    const other = promise({ id: "other" });
    const list = Object.freeze([c, other]);
    expect(settle(list, c.id, state)).toEqual([{ ...c, state }, other]);
    expect(c.state).toBe("open");
    expect(list[1]).toBe(other);
  });
  it("does not reopen or rewrite a settled promise and ignores an unknown ID", () => {
    const list = [promise({ state: "kept" })];
    expect(settle(list, "party-1", "broken")).toEqual(list);
    expect(settle(list, "party-1", "open")).toEqual(list);
    expect(settle(list, "missing", "cancelled")).toEqual(list);
    expect(settle([], "missing", "kept")).toEqual([]);
  });

  const dayList = [
    promise({ id: "yesterday", day: 3, phase: "night" }),
    ...(["morning", "noon", "evening", "night"] as const).map((phase) => promise({ id: phase, phase })),
    promise({ id: "tomorrow", day: 5, phase: "morning" }), promise({ id: "kept", day: 3, state: "kept" }),
  ];
  it.each([
    ["morning", ["yesterday"]], ["noon", ["yesterday", "morning"]],
    ["evening", ["yesterday", "morning", "noon"]], ["night", ["yesterday", "morning", "noon", "evening"]],
  ] as const)("finds only passed open promises at %s", (phase, ids) => {
    expect(missed(dayList, 4, phase).map((c) => c.id)).toEqual(ids);
  });
  it("handles night and the following day without changing the calendar", () => {
    const before = structuredClone(dayList);
    expect(dueNow(dayList, 4, "night").map((c) => c.id)).toEqual(["night"]);
    expect(missed(dayList, 5, "morning").map((c) => c.id)).toEqual(["yesterday", "morning", "noon", "evening", "night"]);
    expect(missed([], 0, "morning")).toEqual([]);
    expect(dayList).toEqual(before);
  });
});

describe("promise outcomes", () => {
  it("remembers both people keeping the promise", () => {
    expect(outcomeMemory(promise(), "kept")).toBe("Kai's birthday party: I went and Kai came");
  });
  it("remembers the inviter standing the NPC up", () => {
    expect(outcomeMemory(promise(), "broken")).toBe("Kai stood me up at the birthday party");
  });
  it("records cancellation and leaves an open promise without an outcome", () => {
    expect(outcomeMemory(promise(), "cancelled")).toBe("Kai's birthday party was cancelled");
    expect(outcomeMemory(promise(), "open")).toBe("");
  });
  it("uses the activity when the occasion is empty", () => {
    expect(outcomeMemory(promise({ act: "fish", occasion: "" }), "broken")).toBe("Kai stood me up at the fishing trip");
    expect(outcomeMemory(promise({ act: "soccer", occasion: "" }), "kept")).toBe("Kai's soccer: I went and Kai came");
  });
  it.each(["kept", "broken", "cancelled"] as const)("keeps a long %s memory within 100 characters", (state) => {
    const c = Object.freeze(promise({ from: "Kai\n".repeat(100), occasion: "birthday\n".repeat(100) }));
    const line = outcomeMemory(c, state);
    expect(line.length).toBeLessThanOrEqual(100);
    expect(line).not.toContain("\n");
    expect(line).not.toContain(c.fromId);
  });
  it("changes affinity only for kept and broken promises", () => {
    expect(outcomeAffinity(person(), "kept")).toBe(15);
    expect(outcomeAffinity(person(), "broken")).toBe(-20);
    expect(outcomeAffinity(person(), "cancelled")).toBe(0);
    expect(outcomeAffinity(person(), "open")).toBe(0);
  });
  it.each([["gentle"], ["patient"], ["gentle", "patient"]])("halves a broken promise's loss for %j", (...traits) => {
    expect(outcomeAffinity(person({ traits }), "broken")).toBe(-10);
    expect(outcomeAffinity(person({ traits }), "kept")).toBe(15);
  });
  it.each([["grumpy"], ["loud"], ["grumpy", "loud"]])("raises a broken promise's loss for %j", (...traits) => {
    expect(outcomeAffinity(person({ traits }), "broken")).toBe(-30);
  });
  it("combines forgiving and harsh traits once each", () => {
    expect(outcomeAffinity(person({ traits: ["gentle", "patient", "grumpy", "loud"] }), "broken")).toBe(-15);
  });
});
