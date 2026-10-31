// A mind's memory (GARP-lite): a rolling log of what happened ("08:10 ate at the bowl"), a few lasting
// facts written by the bedtime reflection, and today's plan. Small enough to save locally and to fit the
// browser model's prompt.

import type { Phase } from "../life/clock";
import type { Belief, Bond } from "./bonds";
import type { Commitment } from "./promises";

export const LOG_MAX = 30;
export const FACTS_MAX = 6;
const KEEP_IMP = 7; // memories this important outlive the everyday ones

export interface MemoryEntry {
  day: number;
  time: string; // "08:10"
  text: string;
  imp?: number; // how much it mattered, 1..10 (default 3)
}

export interface MindMemory {
  log: MemoryEntry[];
  facts: string[];
  plan: Partial<Record<Phase, string[]>>;
  planDay: number; // the day the plan was made (-1 = never)
  reflectDay: number;
  promises: Commitment[]; // what this mind agreed to (promises.ts)
  bonds: Record<string, Bond>; // how it feels about each person, and why (bonds.ts)
  beliefs: Belief[]; // what it holds true about people
  why: string; // its last decision: memory > feeling > choice, shown in the inspector
}

export function emptyMemory(): MindMemory {
  return { log: [], facts: [], plan: {}, planDay: -1, reflectDay: -1, promises: [], bonds: {}, beliefs: [], why: "" };
}

export function remember(m: MindMemory, day: number, time: string, text: string, imp?: number): void {
  const last = m.log[m.log.length - 1];
  if (last && last.text === text && last.day === day) return; // no "ate, ate, ate"
  m.log.push({ day, time, text: text.slice(0, 100), ...(imp ? { imp } : {}) });
  while (m.log.length > LOG_MAX) {
    const small = m.log.findIndex((e) => (e.imp ?? 3) < KEEP_IMP);
    m.log.splice(Math.max(0, small), 1); // the small stuff goes first; what mattered stays
  }
}

export function addFact(m: MindMemory, fact: string): void {
  const f = fact.trim().slice(0, 120);
  if (!f || m.facts.includes(f)) return;
  m.facts.push(f);
  if (m.facts.length > FACTS_MAX) m.facts.shift();
}

export const recent = (m: MindMemory, n: number): MemoryEntry[] => m.log.slice(-n);

// Cheap retrieval for prompts: memories sharing words with a topic or naming `who`, the ones that mattered first
// (Smallville's relevance + importance + recency, with no embeddings; ties: newest first).
export function relevant(m: MindMemory, topic: string, n: number, who = ""): MemoryEntry[] {
  const words = new Set(topic.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3));
  const name = who.toLowerCase();
  if (name) words.add(name);
  return m.log
    .map((e, i) => ({ e, i, s: e.text.toLowerCase().split(/[^a-z]+/).filter((w) => words.has(w)).length }))
    .filter((x) => x.s > 0)
    .map((x) => ({ ...x, s: x.s + (x.e.imp ?? 3) / 10 }))
    .sort((a, b) => b.s - a.s || b.i - a.i)
    .slice(0, n)
    .map((x) => x.e);
}

export const fmt = (e: MemoryEntry): string => `day ${e.day + 1} ${e.time} ${e.text}`;

// Defensive parse for saved minds (old/corrupt saves load empty).
export function parseMemory(raw: unknown): MindMemory {
  const m = emptyMemory();
  if (!raw || typeof raw !== "object") return m;
  const r = raw as Partial<MindMemory>;
  if (Array.isArray(r.log)) m.log = r.log.filter((e) => e && typeof e.text === "string" && typeof e.time === "string" && typeof e.day === "number").slice(-LOG_MAX);
  if (Array.isArray(r.facts)) m.facts = r.facts.filter((f): f is string => typeof f === "string").slice(-FACTS_MAX);
  if (r.plan && typeof r.plan === "object") m.plan = r.plan;
  if (typeof r.planDay === "number") m.planDay = r.planDay;
  if (typeof r.reflectDay === "number") m.reflectDay = r.reflectDay;
  if (Array.isArray(r.promises)) m.promises = r.promises.filter((c) => c && typeof c.id === "string" && typeof c.act === "string" && typeof c.day === "number");
  if (r.bonds && typeof r.bonds === "object") m.bonds = r.bonds;
  if (Array.isArray(r.beliefs)) m.beliefs = r.beliefs.filter((b) => b && typeof b.about === "string" && typeof b.text === "string");
  if (typeof r.why === "string") m.why = r.why;
  return m;
}
