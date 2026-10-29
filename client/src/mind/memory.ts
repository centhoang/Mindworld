// A mind's memory (GARP-lite): a rolling log of what happened ("08:10 ate at the bowl"), a few lasting
// facts written by the bedtime reflection, and today's plan. Small enough to save locally and to fit the
// browser model's prompt.

import type { Phase } from "../life/clock";

export const LOG_MAX = 30;
export const FACTS_MAX = 6;

export interface MemoryEntry {
  day: number;
  time: string; // "08:10"
  text: string;
}

export interface MindMemory {
  log: MemoryEntry[];
  facts: string[];
  plan: Partial<Record<Phase, string[]>>;
  planDay: number; // the day the plan was made (-1 = never)
  reflectDay: number;
}

export function emptyMemory(): MindMemory {
  return { log: [], facts: [], plan: {}, planDay: -1, reflectDay: -1 };
}

export function remember(m: MindMemory, day: number, time: string, text: string): void {
  const last = m.log[m.log.length - 1];
  if (last && last.text === text && last.day === day) return; // no "ate, ate, ate"
  m.log.push({ day, time, text: text.slice(0, 100) });
  if (m.log.length > LOG_MAX) m.log.splice(0, m.log.length - LOG_MAX);
}

export function addFact(m: MindMemory, fact: string): void {
  const f = fact.trim().slice(0, 120);
  if (!f || m.facts.includes(f)) return;
  m.facts.push(f);
  if (m.facts.length > FACTS_MAX) m.facts.shift();
}

export const recent = (m: MindMemory, n: number): MemoryEntry[] => m.log.slice(-n);

// The memories that share the most words with a topic (ties: newest first). Cheap retrieval for prompts.
export function relevant(m: MindMemory, topic: string, n: number): MemoryEntry[] {
  const words = new Set(topic.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3));
  return m.log
    .map((e, i) => ({ e, i, s: e.text.toLowerCase().split(/[^a-z]+/).filter((w) => words.has(w)).length }))
    .filter((x) => x.s > 0)
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
  return m;
}
