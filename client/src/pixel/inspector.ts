// The Mind inspector (I next to a pet or villager): who this mind is, what it plans and remembers, who
// its friends are, and which model is thinking for it on which machine. This is where players (and
// judges) see that the village is run by minds, not scripts.

import { purseText } from "../mind/economy";
import { goalOf, goalText } from "../mind/goals";
import { ACTIVITY } from "../life/activities";
import { feelWord } from "../mind/bonds";
import { PLAN_PHASES } from "../mind/brain";
import type { Mind } from "../mind/hub";
import { friends } from "../life/relations";
import type { Agent } from "../life/village";
import { PAL } from "./art";
import { drawFrame, drawText, GLYPH, wrap } from "./text";

// Which service answered a mind's last line, plain words first and the model after (bug 36 wording). `source` is what
// the line came back with: a model label from the scheduler, "model"/"cache" from the cloud chat (worker /api/chat,
// Muse Spark Open on Baseten), or "rules".
export function serviceLabel(source: string): string {
  if (/llama/i.test(source)) return "thought on your computer (Llama 3.2 1B, tuned)";
  if (source === "model" || source === "cache" || /muse spark open|^muse spark$/i.test(source)) return "from the cloud (Muse Spark Open)";
  if (/muse spark 1|meta model/i.test(source)) return "from the cloud (Muse Spark 1.3, Meta Model API)";
  if (source === "rules") return "the village rules (no model)";
  if (source === "offline" || source === "scripted") return "a scripted line (no model)";
  return source;
}

type Ctx = CanvasRenderingContext2D;
export const SHOW_NEEDS = ["hunger", "energy", "fun", "social"] as const;
const SHORT: Record<string, string> = { morning: "AM", noon: "NOON", evening: "PM" };

// The inspector's text, one [line, colour] each, for any view.
export function inspectorLines(m: Mind, a: Agent, rel: Map<string, number>, names: (id: string) => string, where: string, wrapLine: (s: string) => string[]): [string, string][] {
  const lines: [string, string][] = []; // [text, colour]
  const add = (s: string, col: string = PAL.ink) => wrapLine(s).forEach((l) => lines.push([l, col]));
  const p = m.persona;
  add(`${p.name}  (${p.kind === "pet" ? "PET" : "VILLAGER"})`, PAL.coral);
  add(`LAST LINE: ${serviceLabel(m.source)}${m.source === "rules" ? " (B: load Llama)" : ""}`, PAL.teal);
  add(`RUNS ON: ${where}`, PAL.teal);
  add(`IS: ${p.traits.join(", ")}`);
  add(`LIKES: ${p.hobbies.join(", ")}`);
  const now = m.thinking ? `THINKING: ${m.thinking}...` : a.act ? `NOW: ${ACTIVITY.get(a.act)?.label ?? a.act}${a.state === "walk" ? " (on the way)" : a.state === "wait" ? " (waiting for friends)" : ""}` : "NOW: deciding";
  add(now, PAL.woodD);
  add(`PLAN: ${PLAN_PHASES.map((ph) => `${SHORT[ph]} ${m.mem.plan[ph]?.[0] ?? "-"}`).join("  ")}`);
  const promised = m.mem.promises.filter((c) => c.state === "open").slice(0, 2);
  if (promised.length) add(`PROMISED: ${promised.map((c) => `${c.from}, ${c.occasion || c.act}, day ${c.day + 1} ${c.phase}`).join("; ")}`);
  if (m.mem.purse) add(`HAS: ${purseText(m.mem.purse)}`);
  const goal = m.mem.purse && goalOf(p.id, m.mem.purse);
  if (goal) add(`GOAL: ${goalText(goal, m.mem.purse!)}`);
  const fr = friends(rel, p.id, 1).slice(0, 3);
  add(`FRIENDS: ${fr.length ? fr.map((f) => `${names(f.id)} ${f.affinity}`).join(", ") : "none yet"}`);
  const bond = Object.entries(m.mem.bonds).sort(([, x], [, y]) => Math.abs(y.fondness) + Math.abs(y.trust) - Math.abs(x.fondness) - Math.abs(x.trust))[0];
  if (bond) add(`FEELS: ${feelWord(bond[1])} ${bond[0]} (trust ${bond[1].trust}), ${bond[1].why.at(-1)?.text ?? ""}`, PAL.coral);
  const belief = m.mem.beliefs.at(-1);
  if (belief) add(`THINKS: ${belief.about} ${belief.text}${belief.source ? ` (${belief.source} said)` : ""}`);
  if (m.mem.why) add(`WHY: ${m.mem.why}`, PAL.woodD);
  if (m.mem.facts.length) add(`KNOWS: ${m.mem.facts[m.mem.facts.length - 1]}`, PAL.woodD);
  add("REMEMBERS:", PAL.coral);
  for (const e of m.mem.log.slice(-4).reverse()) add(` ${e.time} ${e.text}`);
  return lines;
}

export function drawInspector(g: Ctx, m: Mind, a: Agent, rel: Map<string, number>, names: (id: string) => string, where: string, sw: number, sh: number): void {
  const w = Math.min(232, sw - 12);
  const x = sw - w - 6;
  const y = 18;
  const tw = w - 14;
  const lines = inspectorLines(m, a, rel, names, where, (s) => wrap(s, tw));
  const barsH = 12;
  const h = Math.min(sh - y - 6, lines.length * 9 + barsH + 14);
  drawFrame(g, x, y, w, h);
  let ly = y + 6;
  for (const [l, col] of lines) {
    if (ly > y + h - barsH - 12) break;
    drawText(g, l, x + 7, ly, col);
    ly += 9;
  }
  // need bars along the bottom
  const bw = Math.floor((w - 14 - 3 * 4) / 4);
  SHOW_NEEDS.forEach((k, i) => {
    const bx = x + 7 + i * (bw + 4);
    const by = y + h - barsH - 4;
    drawText(g, k.slice(0, 3), bx, by - 1, PAL.woodD);
    const fx = bx + 3 * GLYPH + 2;
    const fw = bw - 3 * GLYPH - 2;
    g.fillStyle = PAL.ink;
    g.fillRect(fx, by, fw, 6);
    g.fillStyle = PAL.panel;
    g.fillRect(fx + 1, by + 1, fw - 2, 4);
    const v = Math.max(0, Math.min(100, a.needs[k]));
    g.fillStyle = v < 30 ? PAL.coral : v < 60 ? PAL.flowerY : PAL.grass;
    g.fillRect(fx + 1, by + 1, Math.round(((fw - 2) * v) / 100), 4);
  });
}
