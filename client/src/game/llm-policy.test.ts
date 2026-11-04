import { describe, expect, it, vi } from "vitest";
import { checkLlm, LLM_POLICIES } from "../../../worker/src/llm-policy";
import { ACTIVITIES } from "../life/activities";
import { addBelief, feel } from "../mind/bonds";
import { choosePrompt, emotePrompt, linePrompt, petLinePrompt, planPrompt, reflectPrompt, replyPrompt, SYSTEM } from "../mind/brain";
import { addFact, emptyMemory, FACTS_MAX, LOG_MAX, remember } from "../mind/memory";
import { petPersona, VILLAGERS } from "../mind/persona";
import { SCENE_MAX, sharedScene } from "../mind/scene";
import { runBattle } from "../sim/battle";
import { buildReflectPrompt, buildTeachPrompt, FetchLlmClient, LlmCortex, summarizeFights, SYSTEM_PROMPT } from "../sim/cortex";
import { EMPTY_MEMO, MAX_RULES, validateMemo } from "../sim/memo";
import { ACTIONS, ARCHETYPES, INTENTS, SIZES, type ArchetypeId, type Policy } from "../sim/types";
import { randomGenes } from "./genes";
import { allowedMoves, buildVoicePrompt } from "./instinct";
import { MAX_PARTY, parseParty } from "./party";
import { CloudMind, CloudVoice } from "./voices";

// Mirrors the offline measurement script in .scratch/, without depending on ignored files.
// Use the real validator's limits, including JSON escapes and unrounded numeric conditions.
function saturatedMemo() {
  const result = validateMemo({
    summary: '"'.repeat(200),
    rules: Array.from({ length: MAX_RULES }, (_, i) => ({
      if: Array.from({ length: 3 }, () => ({ k: "enemyHp", op: ">=", n: -0.0000012345678901234567 - i * 1e-20 })),
      do: "befriend", why: "\\".repeat(120),
    })),
  });
  expect(result.dropped).toEqual([]);
  expect(result.memo.rules).toHaveLength(MAX_RULES);
  return result.memo;
}

// The largest summary found by the offline scan of 4,500 actual Battle replays.
function recentFights() {
  const cycle: Policy = (o) => ACTIONS[(o.turn - 1) % ACTIONS.length]!;
  const guardFriend: Policy = (o) => o.turn % 3 ? "guard" : "befriend";
  const cases: [ArchetypeId, number, Policy][] = [
    ["skitter", 58, cycle], ["pal", 14, guardFriend], ["bully", 11, guardFriend],
    ["brute", 32, (o) => o.turn % 2 ? "befriend" : "emote"], ["turtle", 56, cycle],
    ["bully", 6, () => "guard"], ["brute", 92, cycle], ["turtle", 8, () => "attack"],
  ];
  return cases.map(([enemy, seed, policy]) => runBattle({ enemy, seed }, policy));
}

const longestName = () => parseParty([{ arch: "pal", genes: { hue: 0.5 }, name: "AbcdefghijklMORE" }])[0]!.name;

function dialogueCases() {
  const memory = emptyMemory();
  for (let i = 0; i < LOG_MAX; i++) remember(memory, 999999, "23:59", `Elder Gentle Dumpling memory ${i} ` + "a".repeat(100), i < 2 ? 10 : 1);
  for (let i = 0; i < FACTS_MAX; i++) addFact(memory, `fact ${i} ` + "f".repeat(120));
  const player = "Gentle Dumpling";
  const other = VILLAGERS[0]!;
  for (const about of [player, other.name]) {
    feel(memory, other, about, "broken", 999999, "r".repeat(70));
    addBelief(memory, { about, text: "broke a promise", source: "Ama", conf: 0.6, day: 999999 });
    addBelief(memory, { about, text: "likes collecting shiny stones", source: "Ama", conf: 0.6, day: 999999 });
  }
  const scene = sharedScene({ x: 0, z: 0 }, { x: 0, z: 0 }, Array.from({ length: 8 }, () => ({
    name: "Gentle Dumpling's pet", kind: "pet" as const, x: 1, z: -1, doing: "collecting shiny stones",
  })), "the market stall", "evening");
  expect(scene.length).toBeLessThanOrEqual(SCENE_MAX);
  const personas = [...VILLAGERS, ...Array.from({ length: 200 }, (_, i) => petPersona(longestName(), randomGenes(i)))];
  return personas.flatMap((p) => {
    const options = ACTIVITIES.filter((a) => a.id !== "poop" && a.id !== "sleep" && !a.jobOnly && (a.who === "any" || a.who === p.kind)).map((a) => a.id);
    memory.plan = { evening: ["campfire", "dance"] };
    const said = Array.from({ length: 5 }, (_, i) => `${i % 2 ? p.name : other.name}: ${"a".repeat(90)}`);
    return [
      planPrompt(p, memory, options),
      choosePrompt(p, memory, { hunger: 1, energy: 1, fun: 1, social: 1, bladder: 1, hygiene: 1 }, "evening", options.slice().sort((a, b) => b.length - a.length).slice(0, 5), `Nearby: ${Array.from({ length: MAX_PARTY }, () => longestName()).join(", ")}.`),
      linePrompt(p, memory, other, -30, "a".repeat(100), said, scene),
      petLinePrompt(p, memory, `${player}'s pet`, scene),
      replyPrompt(p, memory, player, "a".repeat(140), scene),
      reflectPrompt(p, memory, 999999),
      emotePrompt(p, `${p.name} just danced with ${Array.from({ length: 7 }, () => longestName()).join(" and ")}.`),
    ];
  });
}

describe("real game prompts satisfy the worker policy", () => {
  it("copies the frozen systems exactly", () => {
    expect(LLM_POLICIES.memo.system).toBe(SYSTEM_PROMPT);
    expect(LLM_POLICIES.teach.system).toBe(SYSTEM_PROMPT);
    expect(LLM_POLICIES.dialogue.system).toBe(SYSTEM);
  });

  it("sends real reflect and teach requests through LlmCortex and FetchLlmClient", async () => {
    const memo = saturatedMemo();
    const fetchFn = vi.fn<typeof fetch>(async (_url, init) => {
      const req = JSON.parse(init!.body as string);
      expect(checkLlm(req.kind, req.system, req.prompt)).toBe(LLM_POLICIES[req.kind as "memo" | "teach"]);
      expect(req).toMatchObject({ provider: req.kind === "memo" ? "meta" : "baseten", maxTokens: 4000, effort: "low" });
      return Response.json({ text: JSON.stringify(memo), provider: req.provider, model: "test-double", truncated: false, costUsd: 0, latencyMs: 0 });
    });
    const cortex = new LlmCortex(new FetchLlmClient("", fetchFn));
    await cortex.reflect(memo, recentFights());
    await cortex.teach(memo, "x".repeat(1000));
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const [reflect, teach] = fetchFn.mock.calls.map(([, init]) => JSON.parse(init!.body as string));
    expect(reflect.prompt.length).toBe(5259);
    expect(teach.prompt.length).toBe(4360);
  });

  it("fits saturated memos, JSON escaping, all five enemies and a 300-char lesson", () => {
    const memo = saturatedMemo();
    const replays = recentFights();
    expect(replays).toHaveLength(8);
    expect(new Set(replays.map((r) => r.enemy)).size).toBe(5);
    expect(JSON.stringify(memo).length).toBe(3960);
    expect(summarizeFights(memo, replays).length).toBe(1028);
    for (const [kind, req] of [["memo", buildReflectPrompt(memo, replays)], ["teach", buildTeachPrompt(memo, "x".repeat(300))]] as const) {
      expect(req.prompt.length).toBeLessThanOrEqual(LLM_POLICIES[kind].maxPromptChars);
      expect(req.system.length).toBe(1590);
      expect(checkLlm(kind, req.system, req.prompt)).toBe(LLM_POLICIES[kind]);
    }
  });

  it("accepts every dialogue builder with full facts, memories, talk and scene", async () => {
    const requests = dialogueCases();
    expect(Math.max(...requests.map((r) => r.user.length))).toBe(2688);
    for (const req of requests) {
      expect(req.system.length).toBe(118);
      expect(checkLlm("dialogue", req.system, req.user)).toBe(LLM_POLICIES.dialogue);
    }
    const fetchFn = vi.fn<typeof fetch>(async (_url, init) => {
      const req = JSON.parse(init!.body as string);
      expect(req).toMatchObject({ kind: "dialogue", system: SYSTEM, maxTokens: 400, effort: "low" });
      expect(req).not.toHaveProperty("provider");
      expect(checkLlm(req.kind, req.system, req.prompt)).toBe(LLM_POLICIES.dialogue);
      return Response.json({ text: "Hello there!" });
    });
    const cloud = new CloudMind(0, fetchFn);
    const biggest = requests.reduce((a, b) => a.user.length > b.user.length ? a : b);
    expect(await cloud.complete(biggest, new AbortController().signal)).toBe("Hello there!");
  });

  it("accepts generated pet names and the longest parsed party name", () => {
    const names = Array.from({ length: 12 }, (_, i) => parseParty([{ arch: "pal", genes: { hue: i / 12 }, name: "" }])[0]!.name);
    expect(names).toContain("Mochi");
    expect(names).toContain("Dumpling");
    expect(longestName()).toHaveLength(12);
    for (const name of [...names, longestName(), "Lúa_7", "O'Bean", "A-B"]) {
      const obs = { enemy: "skitter" as const, size: "smaller" as const, intent: "guarding" as const, myHpPct: 100, enemyHpPct: 39, turn: 12, last: "none" as const };
      const req = buildVoicePrompt(name, EMPTY_MEMO, obs, allowedMoves(EMPTY_MEMO, obs));
      expect(checkLlm("move", req.system, req.user)).toBe(LLM_POLICIES.move);
    }
  });

  it("fits every live move configuration and sends the largest through CloudVoice", async () => {
    let biggest = buildVoicePrompt("Mochi", EMPTY_MEMO, { enemy: "brute", size: "bigger", intent: "heavy", myHpPct: 100, enemyHpPct: 100, turn: 1, last: "none" }, { moves: ["guard"], rule: null });
    for (const enemy of ARCHETYPES) for (const size of SIZES) for (const intent of INTENTS) {
      for (const myHpPct of [0, 24, 25, 99, 100]) for (const enemyHpPct of [0, 39, 40, 99, 100]) {
        const obs = { enemy, size, intent, myHpPct, enemyHpPct, turn: 12, last: "none" as const };
        // Instinct.decide never sends a coached-rule prompt: that branch returns immediately.
        const req = buildVoicePrompt(longestName(), EMPTY_MEMO, obs, allowedMoves(EMPTY_MEMO, obs));
        expect(checkLlm("move", req.system, req.user)).toBe(LLM_POLICIES.move);
        if (req.user.length > biggest.user.length) biggest = req;
      }
    }
    expect(biggest.system.length).toBe(200);
    expect(biggest.user.length).toBe(90);
    const fetchFn = vi.fn<typeof fetch>(async (_url, init) => {
      const req = JSON.parse(init!.body as string);
      expect(req).toMatchObject({ kind: "move", provider: "modal", maxTokens: 600, effort: "low" });
      expect(checkLlm(req.kind, req.system, req.prompt)).toBe(LLM_POLICIES.move);
      return Response.json({ text: "attack: Hyaa!" });
    });
    expect(await new CloudVoice({ provider: "modal", fetchFn }).pick(biggest, new AbortController().signal)).toEqual({ action: "attack", line: "Hyaa!" });
  });
});
