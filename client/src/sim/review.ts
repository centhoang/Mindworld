import { Battle } from "./battle";
import type { EnemyDef } from "./enemies";
import { MAX_RULES, type Memo, type Rule } from "./memo";
import { memoPolicy } from "./policy";
import { passesGate } from "./proof";
import { DEFAULT_PET, type PetSpec, type Replay, type TurnRecord } from "./types";

// The coach's review after a fight: what went wrong, read from the replay, and the one lesson to teach next. The
// sim decides, like a rival's study (sim/rivals.ts rehearse): each lesson the replay gives a reason for is sparred
// against this same foe, and only one that wins more practice fights is proposed, and only if it passes the Teach
// gate (no worse against every wild pet), so a lesson for one foe never makes the pet worse in general. The lesson is plain words that
// every coach (Muse Spark, the tuned Llama, the scripted one) turns into the rule below. Pure.

export type LessonId = "heavy" | "wait" | "counter" | "friends";

interface Lesson {
  words: string; // what "Teach it" types into Teach
  rule: Rule; // the rule those words become
}

export const LESSONS: Record<LessonId, Lesson> = {
  heavy: { words: "Guard when the foe winds up a heavy hit.", rule: { if: [{ k: "intent", is: "heavy" }], do: "guard", why: "guard cuts a heavy hit to 40%" } },
  wait: { words: "Emote while the foe guards; don't hit its guard.", rule: { if: [{ k: "intent", is: "guarding" }], do: "emote", why: "a hit into a guard is wasted" } },
  counter: { words: "Attack right after your pet blocks a hit.", rule: { if: [{ k: "last", is: "guard" }], do: "attack", why: "a hit right after a block counters" } },
  friends: { words: "Make friends when the foe's HP is below 40%.", rule: { if: [{ k: "enemyHp", op: "<", n: 40 }], do: "befriend", why: "a hurt foe is easy to befriend" } },
};

// The memo already has the lesson: a rule with the same move on the same kind of moment.
const covers = (m: Memo, l: Lesson): boolean =>
  m.rules.some((x) => x.do === l.rule.do && l.rule.if.every((c) => x.if.some((y) => y.k === c.k && (!("is" in c) || ("is" in y && y.is === c.is)))));

interface Evidence { seen: string; cost: number } // cost: HP the mistake lost, about

const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
const sum = (ts: readonly TurnRecord[], f: (t: TurnRecord) => number) => ts.reduce((a, t) => a + f(t), 0);

// The pet's own moves only: a shouted move was the trainer's call.
function evidence(id: LessonId, rp: Replay, pet: string, foe: string): Evidence | null {
  const own = rp.turns.filter((t) => !t.shout);
  switch (id) {
    case "heavy": {
      const hit = own.filter((t) => t.obs.intent === "heavy" && t.action !== "guard" && t.taken > 0);
      const hp = sum(hit, (t) => t.taken);
      return hit.length ? { seen: `${pet} took ${hit.length === 1 ? "a heavy hit" : `${hit.length} heavy hits`} without guarding (-${hp} HP).`, cost: Math.round(hp * 0.6) } : null;
    }
    case "wait": {
      const into = own.filter((t) => t.obs.intent === "guarding" && t.action === "attack");
      const countered = sum(rp.turns.filter((t) => t.fx?.includes("foe-counter")), (t) => t.taken);
      if (!into.length) return null;
      return { seen: `${pet} hit into ${foe}'s guard ${times(into.length)}${countered ? ` and was countered (-${countered} HP)` : ""}.`, cost: Math.round(1.5 * sum(into, (t) => t.dealt) + countered / 3) };
    }
    case "counter": {
      const missed = rp.turns.filter((t, i) => i > 0 && !t.shout && rp.turns[i - 1]!.fx?.includes("block") && t.action !== "attack" && t.obs.intent !== "heavy" && t.obs.intent !== "guarding");
      return missed.length ? { seen: `${pet} blocked a hit but did not strike back ${times(missed.length)}.`, cost: 4 * missed.length } : null;
    }
    case "friends": {
      if (rp.outcome === "win") return null;
      const i = rp.turns.findIndex((t) => t.obs.enemyHpPct < 40);
      if (i < 0 || rp.turns.slice(i).some((t) => t.action === "befriend")) return null;
      return { seen: `${foe} was hurt, but ${pet} never tried to make friends.`, cost: sum(rp.turns.slice(i), (t) => t.taken) };
    }
  }
}

export const PRACTICE = 32; // practice fights per memo
const MIN_GAIN = 2 / PRACTICE; // a lesson has to win at least two more of them

// How often a memo (its deterministic proxy) beats this foe, over fixed practice seeds.
export function winRate(memo: Memo, def: () => EnemyDef, pet: PetSpec = DEFAULT_PET, rounds = PRACTICE): number {
  const policy = memoPolicy(memo);
  let won = 0;
  for (let s = 0; s < rounds; s++) {
    const enemyDef = def();
    const b = new Battle({ enemy: enemyDef.id, seed: 104729 * (s + 1), pet, enemyDef });
    while (!b.done) b.step(policy(b.observe()));
    if (b.replay().outcome === "win") won++;
  }
  return won / rounds;
}

// A taught rule goes first: every coach puts the newest lesson ahead of the old ones.
export const withLesson = (m: Memo, id: LessonId): Memo => ({ summary: m.summary, rules: [LESSONS[id].rule, ...m.rules].slice(0, MAX_RULES) });

export interface Review {
  id: LessonId;
  seen: string; // what went wrong, or "" when the lesson comes from practice alone
  lesson: string;
  before: number; // practice win rate now
  after: number; // and with the lesson
}

// After a loss with no clear mistake, the coach still tries every lesson the memo lacks; after a win, only ones the
// replay shows a reason for. Null when no lesson would help against this foe.
export function coachReview(rp: Replay, memo: Memo, o: { pet: string; foe: string; def: () => EnemyDef; spec?: PetSpec }): Review | null {
  const open = (Object.keys(LESSONS) as LessonId[]).filter((id) => !covers(memo, LESSONS[id]));
  const seen = open.map((id) => ({ id, ev: evidence(id, rp, o.pet, o.foe) }));
  let pool = seen.filter((c) => c.ev);
  if (!pool.length && rp.outcome !== "win") pool = seen;
  if (!pool.length) return null;
  const before = winRate(memo, o.def, o.spec);
  let best: Review | null = null;
  let bestCost = -1;
  for (const { id, ev } of pool) {
    const after = winRate(withLesson(memo, id), o.def, o.spec);
    if (after - before < MIN_GAIN || !passesGate(memo, withLesson(memo, id))) continue;
    const cost = ev?.cost ?? 0;
    if (!best || after > best.after || (after === best.after && cost > bestCost)) {
      best = { id, seen: ev?.seen ?? "", lesson: LESSONS[id].words, before, after };
      bestCost = cost;
    }
  }
  return best;
}
