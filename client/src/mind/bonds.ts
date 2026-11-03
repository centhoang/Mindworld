// How a mind feels about someone, and why. Fondness, trust and respect each move only through a beat tied to a
// memory, so "why are you mad at me" has a real answer. Beliefs are what a mind holds true about someone, with
// who it heard that from. Who the mind is sets how hard each beat lands. Pure: no model or world state here.

import type { MindMemory } from "./memory";
import type { Persona } from "./persona";

export type Beat = "kept" | "broken" | "kind" | "rude" | "invited" | "gossip" | "sorry" | "gift" | "outfought" | "sparred";

export interface Reason {
  day: number;
  beat: Beat;
  text: string;
}

export interface Bond {
  fondness: number;
  trust: number;
  respect: number;
  why: Reason[]; // newest last
}

export interface Belief {
  about: string;
  text: string; // "likes carrots"
  source: string; // "" = saw or heard it first hand, else who told me
  conf: number; // 0..1
  day: number;
}

export const BELIEFS_MAX = 12;
const WHY_MAX = 4;
const REASON_MAX = 70;

const BEATS: Record<Beat, { fondness: number; trust: number; respect: number }> = {
  kept: { fondness: 12, trust: 10, respect: 3 },
  broken: { fondness: -14, trust: -20, respect: -5 },
  kind: { fondness: 3, trust: 0, respect: 0 },
  rude: { fondness: -8, trust: -2, respect: -2 },
  invited: { fondness: 2, trust: 0, respect: 0 },
  gossip: { fondness: -4, trust: -8, respect: -2 },
  sorry: { fondness: 4, trust: 12, respect: 0 },
  gift: { fondness: 6, trust: 2, respect: 0 },
  outfought: { fondness: 2, trust: 0, respect: 8 }, // their pet beat mine in a duel
  sparred: { fondness: 4, trust: 0, respect: 2 }, // a duel I won, a draw, or the pets made friends
};

const clamp = (n: number): number => Math.max(-100, Math.min(100, Math.round(n)));
const hasTrait = (p: Persona, ...ts: string[]): boolean => p.traits.some((t) => ts.includes(t.toLowerCase()));

// Who the mind is: the gentle forgive, the grumpy and the loud take it hard, the generous warm up faster.
function weight(p: Persona, delta: number): number {
  if (delta >= 0) return hasTrait(p, "generous", "chatty") ? 1.25 : 1;
  return (hasTrait(p, "gentle", "patient") ? 0.5 : 1) * (hasTrait(p, "grumpy", "loud") ? 1.5 : 1);
}

export const bondOf = (m: MindMemory, who: string): Bond | undefined => m.bonds[who];

// One thing happened between this mind and `who`. Returns the change in fondness, for the shared affinity number.
export function feel(m: MindMemory, p: Persona, who: string, beat: Beat, day: number, reason: string): number {
  const b = (m.bonds[who] ??= { fondness: 0, trust: 0, respect: 0, why: [] });
  const d = BEATS[beat];
  const fondness = d.fondness * weight(p, d.fondness);
  b.fondness = clamp(b.fondness + fondness);
  b.trust = clamp(b.trust + d.trust * weight(p, d.trust));
  b.respect = clamp(b.respect + d.respect * weight(p, d.respect));
  const text = reason.replace(/\s+/g, " ").trim().slice(0, REASON_MAX);
  if (text && b.why.at(-1)?.text !== text) b.why = [...b.why, { day, beat, text }].slice(-WHY_MAX);
  return Math.round(fondness);
}

// Too hurt to promise anything: the NPC wants an apology (or a kept promise) first.
export const GRUDGE_TRUST = -20;
export const holdsGrudge = (b: Bond | undefined): boolean => !!b && b.trust <= GRUDGE_TRUST;

// What this person's trust takes off a willingness to say yes.
export const wariness = (b: Bond | undefined): number => (b ? Math.min(0, b.trust) / 2 : 0);

export function feelWord(b: Bond): string {
  if (b.trust <= -10) return "wary of";
  if (b.fondness <= -10) return "cool toward";
  if (b.fondness >= 20) return "fond of";
  return "neutral about";
}

// The worst thing that stands between us, then the best: what a mind brings up when asked.
export const hurt = (b: Bond): Reason | undefined => [...b.why].reverse().find((r) => r.beat === "broken" || r.beat === "rude" || r.beat === "gossip");
const warmth = (b: Bond): Reason | undefined => [...b.why].reverse().find((r) => r.beat === "kept" || r.beat === "kind" || r.beat === "gift");

// The prompt line for how this mind feels about someone. Empty until something happened, so old prompts stay as they were.
export function bondText(m: MindMemory, who: string): string {
  const b = m.bonds[who];
  const beliefs = m.beliefs.filter((x) => x.about === who).slice(-2).map((x) => x.text);
  const reason = b && (hurt(b) ?? warmth(b));
  const feeling = b && reason ? `You feel ${feelWord(b)} ${who}: ${reason.text}.` : "";
  const known = beliefs.length ? `You think ${who} ${beliefs.join(", ")}.` : "";
  return [feeling, known].filter(Boolean).join(" ");
}

// "My" reason, said to the person: "Kai stood me up" -> "you stood me up".
export const toYou = (text: string, who: string): string => text.split(`${who}'s`).join("your").split(who).join("you").replace("you was", "you were");

const WHY_BAD = /\bwhy\b.*\b(?:hate|dislike|don't (?:you )?like|do not like|mad|angry|upset|cold|cool|avoid\w*|ignor\w*|don't trust|sad|won't|wont|refus\w*)\b|\bare you (?:mad|angry|upset)\b/i;
const WHY_GOOD = /\bwhy\b.*\b(?:like|trust|love)\b.*\bme\b/i;

// A question about the relationship gets its real reason, with or without a model. Null = not such a question.
export function whyAnswer(line: string, b: Bond | undefined, who: string): string | null {
  const t = line.replace(/’/g, "'");
  if (WHY_BAD.test(t)) {
    const r = b && hurt(b);
    return r ? `Because ${toYou(r.text, who)}.` : `I am not upset with you, ${who}.`;
  }
  if (WHY_GOOD.test(t)) {
    const r = b && warmth(b);
    return r ? `Because ${toYou(r.text, who)}.` : null;
  }
  return null;
}

export function addBelief(m: MindMemory, b: Belief): boolean {
  const old = m.beliefs.find((x) => x.about === b.about && x.text === b.text);
  if (old) {
    old.conf = Math.min(1, old.conf + 0.2);
    if (!b.source) old.source = "";
    return false;
  }
  m.beliefs = [...m.beliefs, b].slice(-BELIEFS_MAX);
  return true;
}

const SKIP = /^(?:you|it|this|that|them|him|her|to)\b/;

// What a player says about themselves: "I love carrots" -> "likes carrots". Keyword only; no model call.
export function beliefFrom(line: string): string | null {
  const t = line.toLowerCase().replace(/’/g, "'");
  const pick = (m: RegExpExecArray | null): string | null => {
    const what = m?.[1]?.trim().split(/\s+/).slice(0, 3).join(" ");
    return what && what.length > 2 && !SKIP.test(what) ? what : null;
  };
  const like = pick(/\bi (?:really |also )?(?:like|love|enjoy) ([a-z ]{3,24})/.exec(t)) ?? pick(/\bmy favou?rite (?:\w+ )?is ([a-z ]{3,24})/.exec(t));
  if (like) return `likes ${like}`;
  const hate = pick(/\bi (?:really )?(?:hate|don't like|do not like) ([a-z ]{3,24})/.exec(t));
  return hate ? `dislikes ${hate}` : null;
}

const KIND = /\b(?:thank(?:s| you)|you(?:'re| are) (?:great|nice|kind|awesome|the best|amazing|cool)|i like you|good job|well done)\b/i;
const RUDE = /\b(?:shut up|stupid|idiot|i hate you|you(?:'re| are) (?:dumb|annoying|boring|ugly|useless)|go away|loser)\b/i;
const SORRY = /\b(?:sorry|apologi[sz]e|my bad|forgive me)\b/i;
export const toneOf = (line: string): "kind" | "rude" | "sorry" | null => RUDE.test(line) ? "rude" : SORRY.test(line) ? "sorry" : KIND.test(line) ? "kind" : null;

// Something worth passing on: a promise someone broke to me. The gentle and the patient keep it to themselves.
// What was heard travels too, and each teller stays in the chain.
export function gossipFrom(speaker: MindMemory, p: Persona, listener: string): { about: string; text: string; hop?: true } | null {
  if (hasTrait(p, "gentle", "patient")) return null;
  for (const [about, b] of Object.entries(speaker.bonds)) {
    if (about === listener) continue;
    const r = [...b.why].reverse().find((x) => x.beat === "broken" || x.beat === "gossip");
    if (r) return r.beat === "gossip" ? { about, text: r.text, hop: true } : { about, text: r.text };
  }
  return null;
}

// How the news sounds in a mouth, and in the listener's memory ("Pip told me: Kai stood Pip up").
export const gossipLine = (about: string, hop?: boolean): string => `${about} broke a promise${hop ? "" : " to me"}, you know.`;
export const heardFrom = (teller: string, text: string): string => `${teller} told me: ${text.replace(/\bme\b/g, teller)}`;

// News spoken by an NPC another machine hosts reaches mine as that same plain line.
export function parseGossip(say: string, teller: string): { about: string; text: string } | null {
  const m = /^(\S+) broke a promise( to me)?, you know\.$/.exec(say);
  return m ? { about: m[1]!, text: `${m[1]} broke a promise${m[2] ? ` to ${teller}` : ""}` } : null;
}

// Bonds and beliefs travel to the next host as lines in the room log (it keeps lines of up to 120 characters).
const clean = (s: string): string => s.replace(/\|/g, " ");
export function bondLine(who: string, b: Bond): string {
  const r = b.why.at(-1);
  return `bond|${clean(who).slice(0, 24)}|${b.fondness}|${b.trust}|${b.respect}|${r?.beat ?? ""}|${clean(r?.text ?? "")}`;
}
export function beliefLine(b: Belief): string {
  return `belief|${clean(b.about).slice(0, 24)}|${clean(b.text).slice(0, 40)}|${clean(b.source).slice(0, 24)}|${b.conf.toFixed(1)}`;
}

export function parseBondLine(line: string, day: number): { who: string; bond: Bond } | null {
  if (!line.startsWith("bond|")) return null;
  const [, who, f, t, r, beat, text] = line.split("|");
  if (!who || !Object.hasOwn(BEATS, beat || "kept") || [f, t, r].some((n) => !Number.isFinite(Number(n)))) return null;
  const why = beat && text ? [{ day, beat: beat as Beat, text }] : [];
  return { who, bond: { fondness: clamp(Number(f)), trust: clamp(Number(t)), respect: clamp(Number(r)), why } };
}

export function parseBeliefLine(line: string, day: number): Belief | null {
  if (!line.startsWith("belief|")) return null;
  const [, about, text, source, conf] = line.split("|");
  if (!about || !text) return null;
  return { about, text, source: source ?? "", conf: Math.min(1, Math.max(0, Number(conf) || 0.5)), day };
}
