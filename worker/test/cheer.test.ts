import { describe, expect, it } from "vitest";
import { CHEER_DAILY_USD, CHEER_MAX_TOKENS, cheerPrompt, parseCheerAsk, validateCheer } from "../src/cheer";
import { basetenReply, harness, postJson } from "./helpers";

const ASK = { npc: "ama", player: "Kai<script>", pet: "Bolt", foe: "a wild Brute", duel: false, feel: "fond of Kai" };
const LINES = { win: "Oh well done, Bolt! Soup for the champion!", loss: "Never mind, dear. Come have some soup.", friends: "Look at them, friends already!" };
const day = new Date(1_700_000_000_000).toISOString().slice(0, 10);

describe("/api/cheer", () => {
  it("parses the ask: a villager, cleaned names, a foe", () => {
    const a = parseCheerAsk(ASK)!;
    expect(a).toMatchObject({ npc: "ama", player: "Kai script", pet: "Bolt", foe: "a wild Brute", duel: false, feel: "fond of Kai" });
    expect(parseCheerAsk({ ...ASK, npc: "brute" })).toBeNull();
    expect(parseCheerAsk({ ...ASK, pet: "" })).toBeNull();
  });

  it("needs a win and a loss line; friends falls back to win", () => {
    expect(validateCheer(LINES)).toEqual(LINES);
    expect(validateCheer({ win: "Yay!", loss: "Aw." })).toEqual({ win: "Yay!", loss: "Aw.", friends: "Yay!" });
    expect(validateCheer({ win: "Yay!" })).toBeNull();
    expect(validateCheer({ win: "x".repeat(200), loss: "Aw." })).toBeNull();
    expect(validateCheer({ win: "**Go** <b>Bolt</b>!", loss: "Aw." })!.win).toBe("Go bBoltb!");
  });

  it("the prompt is in the villager's voice and names the fight", () => {
    const p = cheerPrompt(parseCheerAsk(ASK)!);
    expect(p).toContain("You are Ama");
    expect(p).toContain("Kai script's pet Bolt fight a wild Brute in the meadow");
    expect(p).toContain("fond of Kai");
  });

  it("asks Muse Spark Open once and books spend; never an error on a bad reply or over the cap", async () => {
    const h = harness();
    h.upstream.respond = async () => basetenReply("hmm " + JSON.stringify(LINES), 300, 200);
    const r = (await (await h.call("/api/cheer", postJson(ASK))).json()) as { source: string; lines: Record<string, string>; model: string };
    expect(r).toMatchObject({ source: "model", lines: LINES, model: "meta-models/muse-spark-open-1026" });
    expect((JSON.parse(String(h.upstream.calls[0]!.init.body)) as { max_tokens: number }).max_tokens).toBeLessThanOrEqual(CHEER_MAX_TOKENS);
    expect((await h.ledger.snapshot()).dailySpentUsd).toBeGreaterThan(0);
    h.upstream.respond = async () => basetenReply("no json");
    expect(await (await h.call("/api/cheer", postJson(ASK))).json()).toMatchObject({ source: "none", why: "invalid", lines: {} });
    const capped = harness();
    await capped.ghosts.put(`cheer:spend:${day}`, String(CHEER_DAILY_USD));
    expect(await (await capped.call("/api/cheer", postJson(ASK))).json()).toMatchObject({ source: "none", why: "job_cap" });
    expect(capped.upstream.calls).toHaveLength(0);
    expect((await h.call("/api/cheer", postJson({ npc: "ama" }))).status).toBe(400);
  });
});
