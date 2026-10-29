// The Mind inspector (I next to a pet or villager): who this mind is, what it plans and remembers, who
// its friends are, and which model is thinking for it on which machine. This is where players (and
// judges) see that the village is run by minds, not scripts.

import { ACTIVITY } from "../life/activities";
import { PLAN_PHASES } from "../mind/brain";
import type { Mind } from "../mind/hub";
import { friends } from "../life/relations";
import type { Agent } from "../life/village";
import { PAL } from "./art";
import { drawFrame, drawText, GLYPH, wrap } from "./text";

type Ctx = CanvasRenderingContext2D;
const SHOW_NEEDS = ["hunger", "energy", "fun", "social"] as const;
const SHORT: Record<string, string> = { morning: "AM", noon: "NOON", evening: "PM" };

export function drawInspector(g: Ctx, m: Mind, a: Agent, rel: Map<string, number>, names: (id: string) => string, where: string, sw: number, sh: number): void {
  const w = Math.min(232, sw - 12);
  const x = sw - w - 6;
  const y = 18;
  const tw = w - 14;
  const lines: [string, string][] = []; // [text, colour]
  const add = (s: string, col: string = PAL.ink) => wrap(s, tw).forEach((l) => lines.push([l, col]));
  const p = m.persona;
  add(`${p.name}  (${p.kind === "pet" ? "PET" : "VILLAGER"})`, PAL.coral);
  add(`MIND: ${m.source === "rules" ? "RULES (B: LOAD LLAMA)" : m.source}`, PAL.teal);
  add(`RUNS ON: ${where}`, PAL.teal);
  add(`IS: ${p.traits.join(", ")}`);
  add(`LIKES: ${p.hobbies.join(", ")}`);
  const now = m.thinking ? `THINKING: ${m.thinking}...` : a.act ? `NOW: ${ACTIVITY.get(a.act)?.label ?? a.act}${a.state === "walk" ? " (on the way)" : a.state === "wait" ? " (waiting for friends)" : ""}` : "NOW: deciding";
  add(now, PAL.woodD);
  add(`PLAN: ${PLAN_PHASES.map((ph) => `${SHORT[ph]} ${m.mem.plan[ph]?.[0] ?? "-"}`).join("  ")}`);
  const fr = friends(rel, p.id, 1).slice(0, 3);
  add(`FRIENDS: ${fr.length ? fr.map((f) => `${names(f.id)} ${f.affinity}`).join(", ") : "none yet"}`);
  if (m.mem.facts.length) add(`KNOWS: ${m.mem.facts[m.mem.facts.length - 1]}`, PAL.woodD);
  add("REMEMBERS:", PAL.coral);
  for (const e of m.mem.log.slice(-4).reverse()) add(` ${e.time} ${e.text}`);
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
