// Training lessons for the local coach (docs/archive/FINETUNE.md step 1): short coaching phrases a player might type.
// Two sources, merged and split into train/val (val = 300, never trained on):
//   template: seeded phrase templates over the memo DSL (precise rules, two conditions, multi-part lessons,
//             negations, feedback, vague advice, off-topic), then player noise (lowercase, slang, typos);
//   muse:     batches written by Muse Spark Open on Modal in a given player style (billed, capped, cached).
// Any lesson that normalizes to one of HELDOUT_LESSONS is dropped, so the step-0 bench stays unseen.
// Usage: npx tsx src/finetune/gen-lessons.ts [--template 1800] [--muse 40] [--val 300] [--seed 7] [--cap 3]
//   --muse n makes sure n Muse batches exist in data/finetune/lessons-muse.jsonl (missing ones are requested).
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { extractJson } from "../sim/memo";
import { mulberry32 } from "../sim/rng";
import { ACTIONS, ARCHETYPES, INTENTS, SIZES, type Action } from "../sim/types";
import { HELDOUT_LESSONS } from "./lessons";
import { ModalClient, pool } from "./modal-client";

export const DATA_DIR = fileURLToPath(new URL("../../../data/finetune/", import.meta.url));

export interface Lesson {
  id: string;
  text: string;
  source: "template" | "muse";
  kind: string; // template family or Muse style index
  withMemo: boolean; // taught on top of an existing memo (the game teaches incrementally)
}

type Rand = () => number;
const pick = <T>(r: Rand, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
const chance = (r: Rand, p: number) => r() < p;

// ---------------- phrase banks ----------------

const ENEMY: Record<(typeof ARCHETYPES)[number], string[]> = {
  brute: ["the brute", "brutes", "the big brute", "a brute", "the brute guy"],
  skitter: ["the skitter", "skitters", "the little skitter", "a skitter", "the fast one"],
  turtle: ["the turtle", "turtles", "the shell guy", "a turtle", "the turtle thing"],
  pal: ["the pal", "pals", "the friendly pal", "a pal", "the pal creature"],
  bully: ["the bully", "bullies", "the mean bully", "a bully", "that bully"],
};
const INTENT: Record<(typeof INTENTS)[number], string[]> = {
  idle: ["it's idle", "it's doing nothing", "it's just standing there", "the enemy is idle", "it isn't doing anything special"],
  heavy: ["it winds up", "it's about to smash you", "it charges a big hit", "a heavy hit is coming", "it telegraphs a big attack", "the enemy winds up a heavy", "it's charging up"],
  guarding: ["it's guarding", "it has its guard up", "it's blocking", "it hides in its shell", "the enemy guards", "its shield is up"],
  calm: ["it looks calm", "it's chill", "it's relaxed", "the enemy is calm", "it seems peaceful"],
  scared: ["it's scared", "it looks frightened", "it's hurt and scared", "the enemy gets scared", "it's shaking", "it's afraid"],
};
const SIZE: Record<(typeof SIZES)[number], string[]> = {
  smaller: ["it's smaller than you", "the enemy is small", "you're bigger than it", "it's a little one"],
  similar: ["it's about your size", "it's the same size as you", "the enemy is your size"],
  bigger: ["it's bigger than you", "the enemy is huge", "it's a big one", "you're smaller than it"],
};
const DO: Record<Action, string[]> = {
  attack: ["attack", "hit it", "punch it", "smack it", "strike", "go aggressive", "fight", "hit hard", "bonk it"],
  guard: ["guard", "block", "shield up", "defend", "protect yourself", "brace", "put your guard up"],
  flee: ["flee", "run away", "run", "retreat", "get out of there", "escape", "bail"],
  emote: ["emote", "be cute", "do a cute dance", "wave at it", "emote at it", "show some love", "do a little emote"],
  befriend: ["befriend it", "make friends", "be its friend", "try to befriend", "offer friendship", "befriend", "make peace"],
};
const ACTION_NOUN: Record<Action, string[]> = {
  attack: ["attacking", "hitting", "fighting"],
  guard: ["guarding", "blocking", "defending"],
  flee: ["fleeing", "running away", "running"],
  emote: ["emoting", "being cute", "dancing"],
  befriend: ["befriending", "making friends", "trying to befriend"],
};
const LAST: Record<Action, string[]> = {
  attack: ["you just attacked", "you attacked last turn", "right after an attack"],
  guard: ["you just guarded", "you guarded last turn", "after you block"],
  flee: ["you tried to flee", "your last move was flee"],
  emote: ["you just emoted", "you emoted last turn", "after an emote"],
  befriend: ["your befriend failed", "you tried befriending last turn"],
};

const pctWord = (r: Rand, n: number): string => {
  if (n === 50 && chance(r, 0.5)) return "half";
  if (n === 25 && chance(r, 0.4)) return "a quarter";
  if (n === 33 && chance(r, 0.6)) return "a third";
  return pick(r, [`${n}%`, `${n}%`, `${n} percent`, `${n}`]);
};
const THRESH = [10, 15, 20, 25, 30, 33, 35, 40, 45, 50, 60, 70, 75, 80];

function hpPhrase(r: Rand, who: "me" | "enemy"): string {
  const n = pick(r, THRESH);
  const below = chance(r, 0.7);
  const w = pctWord(r, n);
  if (who === "me")
    return below
      ? pick(r, [`you're under ${w} hp`, `your health drops below ${w}`, `hp < ${n}`, `your hp is below ${w}`, `you have less than ${w} health`, ...(n <= 30 ? ["you're low on health", "you're almost dead", "you're nearly out of hp"] : [])])
      : pick(r, [`you're above ${w} hp`, `your hp is at least ${w}`, `you're still healthy (over ${w})`, `hp >= ${n}`]);
  return below
    ? pick(r, [`its hp is under ${w}`, `the enemy is below ${w}`, `enemy hp < ${n}`, `it has less than ${w} health left`, ...(n <= 35 ? ["it's weak", "it's almost dead", "it's nearly beaten"] : [])])
    : pick(r, [`it still has over ${w} hp`, `the enemy is above ${w}`, `enemy hp >= ${n}`, `it's still healthy`]);
}

function turnPhrase(r: Rand): string {
  const n = pick(r, [2, 3, 4, 5, 6, 8, 10, 12, 15]);
  return chance(r, 0.6)
    ? pick(r, [`after turn ${n}`, `from turn ${n} on`, `once it's turn ${n}`, ...(n >= 8 ? ["late in the fight", "when the fight drags on"] : [])])
    : pick(r, [`before turn ${n}`, `in the first ${n} turns`, ...(n <= 4 ? ["early on", "at the start of the fight", "on the first turns"] : [])]);
}

function condPhrase(r: Rand): string {
  const k = pick(r, ["intent", "intent", "intent", "enemy", "enemy", "size", "myHp", "myHp", "enemyHp", "enemyHp", "turn", "last"]);
  switch (k) {
    case "intent": return pick(r, INTENT[pick(r, INTENTS)]);
    case "enemy": {
      const e = pick(r, ARCHETYPES);
      return pick(r, [`you fight a ${e}`, `it's a ${e}`, `the enemy is a ${e}`, `you're up against ${pick(r, ENEMY[e])}`]);
    }
    case "size": return pick(r, SIZE[pick(r, SIZES)]);
    case "myHp": return hpPhrase(r, "me");
    case "enemyHp": return hpPhrase(r, "enemy");
    case "turn": return turnPhrase(r);
    default: return pick(r, LAST[pick(r, ACTIONS)]);
  }
}

const ruleFrames = [
  (a: string, c: string) => `${a} when ${c}`,
  (a: string, c: string) => `when ${c}, ${a}`,
  (a: string, c: string) => `if ${c} then ${a}`,
  (a: string, c: string) => `if ${c}, ${a}`,
  (a: string, c: string) => `${c}? ${a}`,
  (a: string, c: string) => `${c} -> ${a}`,
  (a: string, c: string) => `always ${a} if ${c}`,
  (a: string, c: string) => `${a} whenever ${c}`,
  (a: string, c: string) => `make sure you ${a} when ${c}`,
  (a: string, c: string) => `you should ${a} when ${c}`,
  (a: string, c: string) => `pls ${a} if ${c}`,
  (a: string, c: string) => `${c}: ${a}`,
];
const negFrames = [
  (n: string, c: string) => `don't keep ${n} when ${c}`,
  (n: string, c: string) => `stop ${n} when ${c}`,
  (n: string, c: string) => `no ${n} if ${c}`,
  (n: string, c: string) => `never try ${n} when ${c}`,
];

function enemyTip(r: Rand): string {
  const e = pick(r, ENEMY[pick(r, ARCHETYPES)]);
  const a = pick(r, DO[pick(r, ACTIONS)]);
  return pick(r, [
    `against ${e}, ${a} when ${pick(r, INTENT[pick(r, INTENTS)])}`,
    `vs ${e}: ${a}`,
    `${pick(r, ARCHETYPES)}s ${pick(r, ["are easy", "are tricky", "hit hard", "are annoying"])}, ${a} ${pick(r, ["when " + pick(r, INTENT[pick(r, INTENTS)]), "early", "once it's hurt", ""])}`.trim(),
    `when you fight ${e}, ${a} if ${hpPhrase(r, chance(r, 0.5) ? "me" : "enemy")}`,
  ]);
}

const rule = (r: Rand) => pick(r, ruleFrames)(pick(r, DO[pick(r, ACTIONS)]), condPhrase(r));
const rule2 = (r: Rand) => pick(r, ruleFrames)(pick(r, DO[pick(r, ACTIONS)]), `${condPhrase(r)} and ${condPhrase(r)}`);
const negRule = (r: Rand) => pick(r, negFrames)(pick(r, ACTION_NOUN[pick(r, ACTIONS)]), condPhrase(r));
const multi = (r: Rand) => {
  const parts = Array.from({ length: chance(r, 0.6) ? 2 : 3 }, () => (chance(r, 0.25) ? enemyTip(r) : rule(r)));
  return parts.join(pick(r, [", ", "; ", ". ", " and ", ", then ", " otherwise "]));
};
const feedback = (r: Rand) =>
  pick(r, [
    `you keep losing to ${pick(r, ENEMY[pick(r, ARCHETYPES)])}`,
    `you're too ${pick(r, ["passive", "aggressive", "scared", "nice", "reckless", "slow"])}`,
    `you ${pick(r, ["attack", "guard", "run away", "emote", "befriend", "block", "flee"])} too much`,
    `stop ${pick(r, ACTION_NOUN[pick(r, ACTIONS)])} so much`,
    `more ${pick(r, ACTION_NOUN[pick(r, ACTIONS)])}, less ${pick(r, ACTION_NOUN[pick(r, ACTIONS)])}`,
    `you died to ${pick(r, ENEMY[pick(r, ARCHETYPES)])} again, ${pick(r, DO[pick(r, ACTIONS)])} when ${condPhrase(r)}`,
    `last fight you ${pick(r, ["wasted turns", "took too much damage", "ran away too early", "never finished it", "got smashed"])}`,
  ]);
const VAGUE = [
  "be nicer", "be braver", "be smarter", "fight better", "don't be stupid", "play safe", "go for the win", "be careful",
  "take fewer risks", "be more patient", "win more", "be a pacifist", "violence is never the answer", "show no mercy",
  "be a good pet", "do your best", "fight like a champion", "stay alive", "be efficient", "make every turn count",
  "think before you act", "trust your instincts", "be kind to everyone", "only fight when you have to", "finish fights faster",
  "defense wins games", "offense is the best defense", "friendship is power", "be like a ninja", "tank everything",
  "save your hp", "don't waste turns", "play to win", "be cautious with big enemies", "help the weak ones",
];
const OFFTOPIC = [
  "hello", "good job buddy", "what's your name?", "i love you", "lol", "ok", "asdf", "you're cute", "nice",
  "let's go!!", "do a backflip", "eat your vegetables", "sleep well", "who's a good pet", "test", "hi there",
];

const SLANG: [RegExp, string][] = [[/\byou\b/g, "u"], [/\byour\b/g, "ur"], [/\byou're\b/g, "ur"], [/\bplease\b/g, "pls"], [/\bbecause\b/g, "cuz"], [/\bdon't\b/g, "dont"], [/\bit's\b/g, "its"]];

function noise(r: Rand, s: string): string {
  let t = s;
  if (chance(r, 0.25)) for (const [re, w] of SLANG) if (chance(r, 0.6)) t = t.replace(re, w);
  if (chance(r, 0.15)) {
    // one typo: swap or drop a letter inside a word of 4+ letters
    const words = t.split(" ");
    const i = Math.floor(r() * words.length);
    const w = words[i]!;
    if (w.length >= 4) {
      const j = 1 + Math.floor(r() * (w.length - 2));
      words[i] = chance(r, 0.5) ? w.slice(0, j) + w[j + 1] + w[j] + w.slice(j + 2) : w.slice(0, j) + w.slice(j + 1);
      t = words.join(" ");
    }
  }
  if (chance(r, 0.35)) t = t[0]!.toUpperCase() + t.slice(1) + (/[.!?]$/.test(t) ? "" : pick(r, [".", ".", "!"]));
  else if (chance(r, 0.1)) t += pick(r, ["!!", " pls", " ok?", "..."]);
  return t;
}

const FAMILIES: [string, number, (r: Rand) => string][] = [
  ["rule", 0.34, rule],
  ["rule2", 0.14, rule2],
  ["neg", 0.08, negRule],
  ["enemy", 0.12, enemyTip],
  ["multi", 0.16, multi],
  ["feedback", 0.08, feedback],
  ["vague", 0.05, (r) => pick(r, VAGUE)],
  ["offtopic", 0.03, (r) => pick(r, OFFTOPIC)],
];

export const normalize = (s: string): string => s.toLowerCase().replace(/[^a-z0-9<>=%]+/g, " ").trim();

export function templateLessons(n: number, seed: number): { text: string; kind: string }[] {
  const r = mulberry32(seed);
  const out: { text: string; kind: string }[] = [];
  const seen = new Set<string>();
  for (let tries = 0; out.length < n && tries < n * 20; tries++) {
    let x = r();
    let fam = FAMILIES[0]!;
    for (const f of FAMILIES) {
      if ((x -= f[1]) < 0) { fam = f; break; }
    }
    const text = noise(r, fam[2](r).replace(/\s+/g, " ").trim()).slice(0, 300);
    const key = normalize(text);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text, kind: fam[0] });
  }
  return out;
}

// ---------------- Muse-written variety ----------------

export const MUSE_STYLES = [
  "a kid who types in lowercase with typos",
  "a terse competitive player who writes like a strategy guide",
  "a gentle player who hates violence and wants the pet to make friends",
  "vague one-line encouragements that do not name a specific move",
  "per-enemy strategy tips that name the enemy type",
  "precise rules with HP percentages and turn numbers",
  "frustrated feedback right after the pet lost a fight",
  "a non-native English speaker with simple grammar",
  "gaming slang and abbreviations (hp, lol, ngl, fr, op)",
  "long multi-part instructions with three or four clauses",
  "advice that is questionable or conflicts with good play",
  "instructions phrased as questions (\"why don't you guard when...?\")",
  "a parent teaching a young child's pet, very simple words",
  "a player who refers to moves by synonyms (block, shield, run, hug, dance, punch)",
  "tips about the pet's own health and when to be careful",
  "tips about what the enemy telegraphs (winding up, guarding, calm, scared, idle)",
  "tips about enemy size (smaller, similar, bigger than the pet)",
  "tips that depend on the pet's previous move",
  "short commands of two to four words",
  "a roleplayer who talks to the pet like a knight or a wizard",
  "mixed: half precise rules, half vague advice",
  "negative instructions (never do X, stop doing Y, don't Z when W)",
  "tips about the early fight vs the late fight",
  "a speedrunner who wants fights to end as fast as possible",
  "a cautious player who never wants the pet to faint",
];

const MUSE_SYSTEM = [
  "You write test data for a small game. In it, a player coaches a pet that fights turn-based duels by typing short plain-language tips.",
  `The pet's moves: ${ACTIONS.join(", ")} (befriend wins the fight peacefully; flee ends it without a win).`,
  `Enemy types: ${ARCHETYPES.join(", ")}. Each turn the enemy shows an intent: ${INTENTS.join(", ")} (heavy = winding up a big hit).`,
  `The enemy is ${SIZES.join(", ")} relative to the pet. Both sides have HP in percent, and fights last up to about 20 turns.`,
  "Reply with ONLY one JSON object: {\"lessons\": string[]}. Each lesson is one thing a real player might type (3 to 30 words), all different from each other.",
].join("\n");

async function museBatches(target: number, capUsd: number): Promise<void> {
  const path = `${DATA_DIR}lessons-muse.jsonl`;
  const have = new Set<number>(existsSync(path) ? readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => (JSON.parse(l) as { batch: number }).batch) : []);
  const todo = Array.from({ length: target }, (_, i) => i).filter((i) => !have.has(i));
  if (!todo.length) return;
  const llm = new ModalClient({ kind: "lessons", capUsd, maxCalls: todo.length + 5, effort: "low" });
  await pool(todo, 4, async (batch) => {
    const style = MUSE_STYLES[batch % MUSE_STYLES.length]!;
    const prompt = `Write 40 lessons in this style: ${style}.${batch >= MUSE_STYLES.length ? " Avoid the most obvious phrasings; be inventive." : ""}`;
    const reply = await llm.complete({ kind: "teach", system: MUSE_SYSTEM, prompt, maxTokens: 4000 });
    const parsed = extractJson(reply.text) as { lessons?: unknown } | null;
    const lessons = Array.isArray(parsed?.lessons) ? parsed!.lessons.filter((x): x is string => typeof x === "string") : [];
    console.error(`muse batch ${batch}: ${lessons.length} lessons, $${reply.costUsd.toFixed(4)}${reply.truncated ? " (cut off)" : ""}`);
    if (lessons.length) appendFileSync(path, JSON.stringify({ batch, style, lessons }) + "\n");
  });
  console.error(`lessons spend so far: $${llm.spentUsd.toFixed(3)}`);
}

function museLessons(): { text: string; kind: string }[] {
  const path = `${DATA_DIR}lessons-muse.jsonl`;
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean).flatMap((l) => {
    const b = JSON.parse(l) as { batch: number; lessons: string[] };
    return b.lessons.map((text) => ({ text: text.replace(/\s+/g, " ").trim().slice(0, 300), kind: `muse${b.batch % MUSE_STYLES.length}` }));
  });
}

export function buildSplit(template: { text: string; kind: string }[], muse: { text: string; kind: string }[], val: number, seed: number): { train: Lesson[]; val: Lesson[]; droppedHeldout: number } {
  const banned = new Set(HELDOUT_LESSONS.map(normalize));
  const seen = new Set<string>();
  const all: Lesson[] = [];
  let droppedHeldout = 0;
  const r = mulberry32(seed + 1);
  for (const [source, xs] of [["muse", muse], ["template", template]] as const) {
    for (const x of xs) {
      const key = normalize(x.text);
      if (!key) continue;
      if (banned.has(key)) { droppedHeldout++; continue; }
      if (seen.has(key)) continue;
      seen.add(key);
      all.push({ id: "", text: x.text, source, kind: x.kind, withMemo: chance(r, 0.25) });
    }
  }
  // Seeded Fisher-Yates shuffle, then ids in final order.
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [all[i], all[j]] = [all[j]!, all[i]!];
  }
  all.forEach((l, i) => (l.id = `L${String(i).padStart(4, "0")}`));
  return { val: all.slice(0, val), train: all.slice(val), droppedHeldout };
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name: string, d: number) => {
    const i = args.indexOf(name);
    return i >= 0 ? Number(args[i + 1]) : d;
  };
  mkdirSync(DATA_DIR, { recursive: true });
  const museN = opt("--muse", 0);
  if (museN > 0) await museBatches(museN, opt("--cap", 3));
  const seed = opt("--seed", 7);
  const template = templateLessons(opt("--template", 1800), seed);
  const muse = museLessons();
  const { train, val, droppedHeldout } = buildSplit(template, muse, opt("--val", 300), seed);
  const jsonl = (xs: Lesson[]) => xs.map((x) => JSON.stringify(x)).join("\n") + "\n";
  writeFileSync(`${DATA_DIR}lessons-train.jsonl`, jsonl(train));
  writeFileSync(`${DATA_DIR}lessons-val.jsonl`, jsonl(val));
  const count = (xs: Lesson[], s: string) => xs.filter((x) => x.source === s).length;
  console.log(`train ${train.length} (template ${count(train, "template")}, muse ${count(train, "muse")}), val ${val.length}, dropped as held-out ${droppedHeldout}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
