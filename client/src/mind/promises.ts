// Invitations, a small calendar and the memories left by promises. Pure: no model or world state here.

import { ACTIVITY } from "../life/activities";
import type { Phase } from "../life/clock";
import type { LmRequest } from "./brain";
import { recent, relevant, type MindMemory } from "./memory";
import { personaCard, traitBias, type Persona } from "./persona";

export interface Invite {
  act: string;
  occasion: string;
  day: number;
  phase: Phase;
}

export interface Commitment extends Invite {
  id: string;
  from: string;
  fromId: string;
  state: "open" | "kept" | "broken" | "cancelled";
  importance: number;
}

export type Decision = "accept" | "decline" | "counter";

const SYSTEM = "You are a villager in a cozy game. Reply only in the requested format.";
const PHASE_ORDER: Record<Phase, number> = { morning: 0, noon: 1, evening: 2, night: 3 };
const validDay = (day: number): boolean => Number.isSafeInteger(day) && day >= 0;
const short = (s: string, n: number): string => s.replace(/\s+/g, " ").trim().slice(0, n);
const clamp = (n: number): number => Math.min(1, Math.max(0, Number.isNaN(n) ? 0 : n));

// Keyword fallback. Time alone is an invitation only when the player asks a question.
export function extractRules(line: string, today: number): Invite | null {
  if (!validDay(today)) return null;
  const t = line.toLowerCase().replace(/\u2019/g, "'").replace(/\s+/g, " ").trim();
  const future = /\b(?:tomorrow|tonight)\b/.test(t);
  if (!future && /\b(?:yesterday|ago|last (?:night|morning|noon|evening|week|month|year))\b/.test(t)) return null;
  if (!future && /^(?:did|was|were|had)\b/.test(t)) return null;
  if (/\b(?:don't|do not|never) (?:come|join|want to)\b|\blet's not\b/.test(t)) return null;
  const asks = /\b(?:come|join)\b|\blet's\b|\b(?:want to|can you)\b/.test(t);
  const timedQuestion = t.includes("?") && /\b(?:today|tomorrow|tonight|morning|noon|evening)\b/.test(t);
  if (!asks && !timedQuestion) return null;
  const act = /\b(?:danc(?:e|es|ing)|part(?:y|ies)|birthdays?)\b/.test(t) ? "dance"
    : /\b(?:soccer|football)\b/.test(t) ? "soccer"
    : /\bfish(?:es|ing)?\b/.test(t) ? "fish"
    : /\b(?:picnic(?:s|king)?|lunch)\b/.test(t) ? "picnic" : null;
  if (!act) return null;
  const day = today + (/\btomorrow\b/.test(t) ? 1 : 0);
  if (!validDay(day)) return null;
  const phase: Phase = /\bmorning\b/.test(t) ? "morning" : /\bnoon\b/.test(t) ? "noon" : "evening";
  const occasion = t.match(/\bbirthday(?: party)?\b/)?.[0] ?? (/\bparty\b/.test(t) ? "party" : "");
  return { act, occasion, day, phase };
}

export function extractPrompt(line: string): LmRequest {
  const message = short(line, 180).split(" ").slice(0, 26).join(" ");
  return {
    system: SYSTEM,
    user: `Extract an invitation, never a past event or plain statement. party/birthday=dance; football=soccer; fishing=fish; lunch=picnic. Defaults: today,evening. tonight=today,evening. Reply none or act,day,phase (dance|soccer|fish|picnic; today|tomorrow; morning|noon|evening).\nMessage: "${message}"`,
    grammar: 'root ::= "none" | act "," day "," phase\nact ::= "dance" | "soccer" | "fish" | "picnic"\nday ::= "today" | "tomorrow"\nphase ::= "morning" | "noon" | "evening"',
    maxTokens: 16,
    temperature: 0,
  };
}

export function parseExtract(text: string, today: number): Invite | null {
  if (!validDay(today)) return null;
  const parts = /^(dance|soccer|fish|picnic)\s*,\s*(today|tomorrow)\s*,\s*(morning|noon|evening)$/.exec(text.trim().toLowerCase());
  if (!parts) return null;
  const day = today + (parts[2] === "tomorrow" ? 1 : 0);
  if (!validDay(day)) return null;
  return { act: parts[1]!, occasion: "", day, phase: parts[3] as Phase };
}

export function inviteScore(p: Persona, affinity: number, act: string, conflicts: number): number {
  const label = ACTIVITY.get(act)?.label.split(" ").at(-1) ?? act;
  const roots = [act, label].map((w) => w.toLowerCase().replace(/(?:es|s|e)$/, ""));
  const hobbies = p.hobbies.join(" ").toLowerCase().match(/[a-z]+/g) ?? [];
  const likes = roots.some((root) => root.length > 0 && hobbies.some((w) => w.startsWith(root)));
  return clamp(0.5 + affinity / 200 + (likes ? 0.25 : 0) + traitBias(p, act) - 0.3 * Math.max(0, conflicts));
}

export function decidePrompt(p: Persona, m: MindMemory, invite: Invite, from: string, score: number, mood: string | readonly string[] = ""): LmRequest {
  const willingness = clamp(score);
  const feel = willingness > 0.66 ? "keen" : willingness < 0.33 ? "reluctant" : "unsure";
  const memory = relevant(m, `${from} ${invite.act} ${invite.occasion}`, 1)[0]?.text ?? m.facts.at(-1) ?? recent(m, 1)[0]?.text ?? "none";
  const words = typeof mood === "string" ? mood : mood.join(", ");
  return {
    system: SYSTEM,
    user: `${short(personaCard(p), 150)}\nMood: ${short(words, 40) || "steady"}. Memory: ${short(memory, 70)}\n${short(from, 24)} invites you to ${short(invite.occasion || invite.act, 30)} (${short(invite.act, 20)}), day ${invite.day} ${invite.phase}.\nWillingness ${willingness.toFixed(2)}: ${feel}. Let this feeling guide your choice. Reply accept, decline, or counter.`,
    grammar: 'root ::= "accept" | "decline" | "counter"',
    maxTokens: 4,
    temperature: 0.5,
  };
}

export function parseDecision(text: string): Decision | null {
  const t = text.trim().toLowerCase();
  return t === "accept" || t === "decline" || t === "counter" ? t : null;
}

export const ruleDecision = (score: number): Decision => score >= 0.55 ? "accept" : score >= 0.35 ? "counter" : "decline";

export const dueNow = (list: readonly Commitment[], day: number, phase: Phase): Commitment[] =>
  list.filter((c) => c.state === "open" && c.day === day && c.phase === phase);

// Return a new calendar. Repeated invitations keep their original identity and outcome.
export function addCommitment(list: readonly Commitment[], c: Commitment): Commitment[] {
  if (!c.id.trim() || !c.from.trim() || !c.fromId.trim() || !ACTIVITY.has(c.act) || !validDay(c.day) || !Object.hasOwn(PHASE_ORDER, c.phase)) return [...list];
  if (c.state !== "open" && c.state !== "kept" && c.state !== "broken" && c.state !== "cancelled") return [...list];
  if (list.some((old) => old.id === c.id || (old.act === c.act && old.day === c.day && old.phase === c.phase && old.fromId === c.fromId))) return [...list];
  const importance = Number.isFinite(c.importance) ? Math.min(10, Math.max(1, c.importance)) : 1;
  const next = [...list, { ...c, occasion: short(c.occasion, 30), importance }];
  const open = next.filter((item) => item.state === "open").sort((a, b) => a.importance - b.importance);
  const dropped = new Set(open.slice(0, Math.max(0, open.length - 8)));
  return next.filter((item) => !dropped.has(item));
}

export function settle(list: readonly Commitment[], id: string, state: Commitment["state"]): Commitment[] {
  if (state !== "kept" && state !== "broken" && state !== "cancelled") return [...list];
  return list.map((c) => c.id === id && c.state === "open" ? { ...c, state } : c);
}

// Night closes the day's invitations; due promises are not missed until the next phase.
export const missed = (list: readonly Commitment[], day: number, phase: Phase): Commitment[] =>
  list.filter((c) => c.state === "open" && (c.day < day || (c.day === day && PHASE_ORDER[c.phase] < PHASE_ORDER[phase])));

// A broken promise means the inviter did not show up.
export function outcomeMemory(c: Commitment, state: Commitment["state"]): string {
  const name = short(c.from, 24) || "Someone";
  const event = short(c.occasion, 30) || short(c.act === "fish" ? "fishing trip" : c.act, 30);
  const line = state === "kept" ? `${name}'s ${event}: I went and ${name} came`
    : state === "broken" ? `${name} stood me up at the ${event}`
    : state === "cancelled" ? `${name}'s ${event} was cancelled` : "";
  return line.slice(0, 100);
}

// What a mind says when it answers an invitation (the model's own line replaces it when one is running).
export function answerLine(d: Decision, c: Invite, from: string): string {
  const event = c.occasion || (c.act === "fish" ? "fishing" : c.act);
  if (d === "accept") return `Yes, ${from}! I will be there for the ${event}.`.replace("the fishing", "fishing");
  return d === "counter" ? `Maybe, ${from}. Can we do it another time?` : `Sorry ${from}, not this time.`;
}

// Open promises travel to the next host as a line in the NPC's room log, so a promise outlives its host's tab.
const WIRE = "promise|";
export const promiseLine = (c: Commitment): string => `${WIRE}${[c.id, c.from, c.fromId, c.act, c.occasion, c.day, c.phase, c.state, c.importance].join("|")}`;
export function parsePromiseLine(line: string): Commitment | null {
  if (!line.startsWith(WIRE)) return null;
  const [id, from, fromId, act, occasion, day, phase, state, importance] = line.slice(WIRE.length).split("|");
  if (!id || !from || !fromId || !act || !Object.hasOwn(PHASE_ORDER, phase ?? "")) return null;
  if (state !== "open" && state !== "kept" && state !== "broken" && state !== "cancelled") return null;
  return { id, from, fromId, act, occasion: occasion ?? "", day: Number(day), phase: phase as Phase, state, importance: Number(importance) || 1 };
}

export function outcomeAffinity(p: Persona, state: Commitment["state"]): number {
  if (state === "kept") return 15;
  if (state !== "broken") return 0;
  const traits = p.traits.map((t) => t.toLowerCase());
  const gentle = traits.some((t) => t === "gentle" || t === "patient");
  const harsh = traits.some((t) => t === "grumpy" || t === "loud");
  return -20 * (gentle ? 0.5 : 1) * (harsh ? 1.5 : 1);
}
