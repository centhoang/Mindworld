// The Village Gazette's raw material: what the villagers noted yesterday (promises kept or broken, duels, gifts,
// deals, things bought), as "Villager: note" lines, the ones that mattered first. Muse Spark 1.3 turns them into
// three headlines on the worker (/api/gazette); with the cloud off or failing, `rulesHeadlines` writes them here
// from the same lines, so the paper always tells of real events.
import type { MemoryEntry } from "./memory";

export const GAZETTE_NOTES = 10;
const PER_VILLAGER = 4;
const NOTABLE = 4; // memories at least this important are news (promises 8, duels 6, gifts 6, deals 5, refusals 4)
const MAX_HEADLINE = 70;

export interface NoteSource {
  name: string; // "Mo"
  log: readonly MemoryEntry[];
}

// Yesterday's news, the biggest first; everyday doings only fill in when the day was quiet.
export function gazetteNotes(minds: readonly NoteSource[], day: number, max = GAZETTE_NOTES): string[] {
  const rows = minds.flatMap((m) =>
    m.log
      .filter((e) => e.day === day && !e.text.includes("|") && e.text.length > 3)
      .map((e, i) => ({ name: m.name, e, i }))
      .sort((a, b) => (b.e.imp ?? 3) - (a.e.imp ?? 3) || b.i - a.i)
      .slice(0, PER_VILLAGER),
  );
  const big = rows.filter((r) => (r.e.imp ?? 3) >= NOTABLE).sort((a, b) => (b.e.imp ?? 3) - (a.e.imp ?? 3));
  const small = rows.filter((r) => (r.e.imp ?? 3) < NOTABLE);
  const pick = big.length >= 3 ? big : [...big, ...small.slice(0, 6 - big.length)];
  return [...new Set(pick.map((r) => `${r.name}: ${r.e.text}`))].slice(0, max);
}

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const fit = (s: string) => (s.length <= MAX_HEADLINE ? s : `${s.slice(0, MAX_HEADLINE - 3).replace(/\s+\S*$/, "")}...`);

// One note as a headline, by the shapes the sim writes (promises.ts outcomeMemory, rivals.ts duelMemory, npcs.ts).
export function noteHeadline(note: string): string | null {
  const at = note.indexOf(": ");
  if (at < 1) return null;
  const n = note.slice(0, at), t = note.slice(at + 2);
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(.+?)'s (.+): I went and (.+) came$/))) return `${m[3]} keeps a promise to ${n}: the ${m[2]}`;
  if ((m = t.match(/^(.+) stood me up at the (.+)$/))) return `${n} waits in vain: ${m[1]} missed the ${m[2]}`;
  if ((m = t.match(/^(.+)'s (.+) was cancelled$/))) return `${m[1]}'s ${m[2]} is called off`;
  if ((m = t.match(/^(.+)'s pet beat my (.+) in a duel$/))) return `${m[1]}'s pet beats ${n}'s ${m[2]} in a duel!`;
  if ((m = t.match(/^my (.+) beat (.+)'s pet in a duel$/))) return `${n}'s ${m[1]} wins a duel against ${m[2]}`;
  if ((m = t.match(/^my (.+) and (.+)'s pet became friends in a duel$/))) return `A duel ends in friendship: ${m[1]} and ${m[2]}'s pet`;
  if ((m = t.match(/^my (.+) and (.+)'s pet fought to a draw$/))) return `${n}'s ${m[1]} and ${m[2]}'s pet fight to a draw`;
  if ((m = t.match(/^watched (.+)'s pet (.+) (beat|lose to|make friends with|draw with) (.+)$/))) {
    const verb = { beat: "beats", "lose to": "loses to", "make friends with": "makes friends with", "draw with": "draws with" }[m[3]!];
    return `${m[1]}'s ${m[2]} ${verb} ${m[4]} as ${n} watches`;
  }
  if (t === "scored a goal at the pitch") return `${n} scores a goal at the pitch!`;
  if ((m = t.match(/^(.+) scored a goal at the pitch$/))) return `${m[1]} scores a goal as ${n} cheers`;
  if ((m = t.match(/^saved up and bought (.+)$/))) return `${n} saves up and buys ${m[1]} at last`;
  if ((m = t.match(/^sold (\d+) (\w+) at the market for (\d+)c$/))) return `${n} sells ${m[1]} ${m[2]} at the market for ${m[3]}c`;
  if ((m = t.match(/^(bought|sold) (\d+) (\w+) (from|to) (.+) for (\d+)c$/))) return `${n} ${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}`;
  if ((m = t.match(/^(.+) agreed to (\w+) with me/))) return `${m[1]} and ${n} make plans to ${m[2]}`;
  if ((m = t.match(/^refused to deal with (.+)$/))) return `${n} turns ${m[1]} away at the stall`;
  if ((m = t.match(/^(.+) told me: (.+)$/))) return `Word around the village: ${m[2]}`;
  return null;
}

// Three headlines without a model: the notes the sim can read, then the market, then a quiet day.
export function rulesHeadlines(notes: readonly string[], prices: readonly string[]): string[] {
  const out: string[] = [];
  for (const note of notes) {
    const h = noteHeadline(note);
    if (h && !out.includes(fit(cap(h)))) out.push(fit(cap(h)));
    if (out.length === 3) return out;
  }
  if (prices.length) out.push(fit(`Market today: ${prices.slice(0, 4).join(", ")}`));
  const plain = notes.find((n) => !noteHeadline(n)); // a note no headline told yet
  if (out.length < 3 && plain) out.push(fit(`From ${plain.replace(": ", "'s diary: ")}`));
  if (out.length < 3 && !notes.length) out.push("A quiet day in the village");
  if (out.length < 3) out.push("Everyone is welcome at the campfire tonight");
  return [...new Set(out)].slice(0, 3);
}
