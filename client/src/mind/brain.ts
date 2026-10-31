// What a mind asks its model, and how the answer is checked. Five decisions, each small and constrained:
// plan (once a day), choose (the next activity, only from the sim's valid choices), line (one sentence of
// talk), emote and reflect (one lasting fact before sleep). Every builder returns a prompt + grammar, every
// parser rejects anything outside the allowed set, and every decision has a scripted fallback, so the sim
// never depends on the model. Pure: tested without a GPU.

import { ACTIVITY } from "../life/activities";
import type { Phase } from "../life/clock";
import type { Needs } from "../life/needs";
import { EMOTES, type Emote } from "../world/live";
import { bondText } from "./bonds";
import { fmt, recent, relevant, type MindMemory } from "./memory";
import { personaCard, type Persona } from "./persona";

export interface LmRequest {
  system: string;
  user: string;
  grammar?: string;
  maxTokens: number;
  temperature: number;
}

const SYSTEM = "You are the inner voice of a character in a cozy village game. Stay in character. Answer only in the requested format.";
const LINE_CHARS = `[a-zA-Z ,.!?']`;
export const LINE_MAX = 90;
const alt = (xs: readonly string[]) => xs.map((x) => `"${x}"`).join(" | ");

function needsText(n: Needs): string {
  const low = (Object.entries(n) as [string, number][]).filter(([, v]) => v < 40).map(([k]) => k);
  return low.length ? `Feels low on: ${low.join(", ")}.` : "Feels fine.";
}

function memoryText(m: MindMemory, topic = "", n = 4, who = ""): string {
  const picked = topic ? relevant(m, topic, 2, who) : [];
  const rest = recent(m, n).filter((e) => !picked.includes(e));
  const lines = [...picked, ...rest].map(fmt);
  const facts = m.facts.length ? `Known facts: ${m.facts.join("; ")}.\n` : "";
  const feeling = who ? bondText(m, who) : "";
  return `${facts}${lines.length ? `Recent memories:\n${lines.join("\n")}` : "No memories yet."}${feeling ? `\n${feeling}` : ""}`;
}

// --- plan: one activity per part of the day -------------------------------------------------------
export const PLAN_PHASES: Phase[] = ["morning", "noon", "evening"];
export function planPrompt(p: Persona, m: MindMemory, options: readonly string[]): LmRequest {
  return {
    system: SYSTEM,
    user: `${personaCard(p)}\n${memoryText(m)}\nPlan ${p.name}'s day. Pick one activity for the morning, the noon and the evening from: ${options.join(", ")}.\nAnswer as: morning,noon,evening`,
    grammar: `root ::= act "," act "," act\nact ::= ${alt(options)}`,
    maxTokens: 24,
    temperature: 0.8,
  };
}
export function parsePlan(text: string, options: readonly string[]): Partial<Record<Phase, string[]>> | null {
  const parts = text.trim().split(/\s*,\s*/);
  if (parts.length < 3 || !parts.slice(0, 3).every((x) => options.includes(x))) return null;
  return { morning: [parts[0]!], noon: [parts[1]!], evening: [parts[2]!] };
}

// --- choose: the next activity among the sim's valid ones --------------------------------------------
export function choosePrompt(p: Persona, m: MindMemory, needs: Needs, phase: Phase, choices: readonly string[], company: string): LmRequest {
  const plan = m.plan[phase]?.length ? `Plan for this ${phase}: ${m.plan[phase]!.join(", ")}.` : "";
  return {
    system: SYSTEM,
    user: `${personaCard(p)}\n${memoryText(m)}\nIt is ${phase}. ${needsText(needs)} ${plan} ${company}\nWhat does ${p.name} do next? Options: ${choices.join(", ")}.\nAnswer with one option.`,
    grammar: `root ::= ${alt(choices)}`,
    maxTokens: 8,
    temperature: 0.7,
  };
}
export function parseChoice(text: string, choices: readonly string[]): string | null {
  const t = text.trim().toLowerCase();
  return choices.find((c) => t === c) ?? choices.find((c) => t.startsWith(c)) ?? null;
}

// --- line: one sentence of talk to another mind --------------------------------------------------------
// `scene` (scene.ts) = what this mind can see right now; empty = the prompt stays exactly as before.
const sceneLine = (scene: string): string => (scene ? `Around you: ${scene}\n` : "");

export function linePrompt(p: Persona, m: MindMemory, other: Persona, affinity: number, topic: string, said: readonly string[], scene = ""): LmRequest {
  const feel = affinity > 30 ? "a good friend" : affinity < -20 ? "someone they find annoying" : "someone they know a little";
  const convo = said.length ? `The conversation so far:\n${said.join("\n")}\n` : `${p.name} starts the conversation.\n`;
  return {
    system: SYSTEM,
    user: `${personaCard(p)}\n${memoryText(m, `${topic} ${other.name}`, 2, other.name)}\n${p.name} meets ${other.name}, ${feel}. Topic: ${topic}.\n${sceneLine(scene)}${convo}Write ${p.name}'s next line: one short sentence, under 15 words, no emoji.`,
    grammar: `root ::= ${LINE_CHARS}{2,${LINE_MAX}}`,
    maxTokens: 24,
    temperature: 0.9,
  };
}
// A villager passes a pet (a small creature that can't talk back): one line to it or about it.
export function petLinePrompt(p: Persona, m: MindMemory, pet: string, scene = ""): LmRequest {
  return {
    system: SYSTEM,
    user: `${personaCard(p)}
${memoryText(m, pet, 1)}
${sceneLine(scene)}${p.name} walks past ${pet}, a small pet creature resting nearby. Write what ${p.name} says to the pet or about it: one short sentence, under 12 words, no emoji.`,
    grammar: `root ::= ${LINE_CHARS}{2,${LINE_MAX}}`,
    maxTokens: 20,
    temperature: 0.9,
  };
}

// A player walks up and says something: the mind answers in character, using what it remembers.
export function replyPrompt(p: Persona, m: MindMemory, player: string, line: string, scene = ""): LmRequest {
  return {
    system: SYSTEM,
    user: `${personaCard(p)}
${memoryText(m, line, 3, player)}
${sceneLine(scene)}A visitor, ${player}, says to ${p.name}: "${line.slice(0, 140)}"
Write ${p.name}'s answer: one or two short sentences, under 25 words, in character, no emoji. Use only the memories above and never invent events; show how you feel.${scene ? " If they ask about something around you, answer only from what is listed there." : ""}`,
    grammar: `root ::= ${LINE_CHARS}{2,${LINE_MAX}}`,
    maxTokens: 40,
    temperature: 0.8,
  };
}

export function parseLine(text: string, name: string): string | null {
  let t = text.trim().replace(/^["']|["']$/g, "");
  t = t.replace(new RegExp(`^${name}\\s*:\\s*`, "i"), "");
  t = t.replace(/[^a-zA-Z ,.!?']/g, "").replace(/\s+/g, " ").trim();
  if (t.length < 2) return null;
  if (t.length > LINE_MAX) t = `${t.slice(0, LINE_MAX - 3).replace(/\s+\S*$/, "")}...`;
  return t;
}

// --- emote ----------------------------------------------------------------------------------------------
export function emotePrompt(p: Persona, situation: string): LmRequest {
  return {
    system: SYSTEM,
    user: `${personaCard(p)}\n${situation}\nWhich gesture fits ${p.name} right now? Options: ${EMOTES.join(", ")}, none.`,
    grammar: `root ::= ${alt([...EMOTES, "none"])}`,
    maxTokens: 4,
    temperature: 0.7,
  };
}
export function parseEmote(text: string): Emote | null {
  const t = text.trim().toLowerCase();
  return (EMOTES as readonly string[]).includes(t) ? (t as Emote) : null;
}

// --- reflect: one lasting fact from today's memories ------------------------------------------------------
export function reflectPrompt(p: Persona, m: MindMemory, day: number): LmRequest {
  const today = m.log.filter((e) => e.day === day).slice(-10).map(fmt);
  return {
    system: SYSTEM,
    user: `${personaCard(p)}\nToday ${p.name}:\n${today.join("\n") || "did not do much."}\nBefore sleeping, ${p.name} thinks about the day. Write one short sentence ${p.name} will remember, under 15 words.`,
    grammar: `root ::= ${LINE_CHARS}{2,${LINE_MAX}}`,
    maxTokens: 32,
    temperature: 0.7,
  };
}

// --- scripted fallbacks (no model, or the model was too slow) ---------------------------------------------
const OPENERS = ["Hi {o}! Nice day, right?", "Hey {o}, want to play later?", "{o}! I was looking for you.", "Oh, hello {o}."];
const REPLIES = ["Sure, sounds fun!", "Maybe after my nap.", "Hi! I just ate, I'm so full.", "Yes! Let's go!"];
const PET_LINES = ["Hello, little {o}!", "{o}, you look sleepy today.", "Who's a good one? You are, {o}!", "Careful by the water, {o}.", "{o}! Did you eat yet?"];
export const scriptedPetLine = (p: Persona, pet: string, k: number): string => PET_LINES[(k + p.name.length + pet.length) % PET_LINES.length]!.replace("{o}", pet);

export function scriptedLine(p: Persona, other: Persona, turn: number, k: number): string {
  const pool = turn === 0 ? OPENERS : REPLIES;
  return pool[(k + p.name.length) % pool.length]!.replace("{o}", other.name);
}

// Memory text for sim events ("ate at the bowl", "played ball with Sprig").
const PAST: Record<string, string> = {
  eat: "ate at the bowl", sleep: "slept", nap: "took a nap", poop: "pooped on the lawn", groom: "groomed", ball: "played ball",
  dance: "danced", wander: "wandered around", cook: "cooked", clean: "cleaned up a mess", feed: "fed the pets", fish: "went fishing",
  picnic: "had a picnic", soccer: "played soccer", sell: "worked the market stall", chop: "chopped wood", tend: "tended the herbs",
};
export function eventText(act: string, mates: readonly string[]): string {
  const verb = PAST[act] ?? ACTIVITY.get(act)?.label ?? act;
  return mates.length ? `${verb} with ${mates.join(" and ")}` : verb;
}
