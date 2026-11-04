// The Village Gazette on the client: once per game day, today's paper about yesterday. The client that hosts the
// villagers sends what they noted (mind/gazette.ts) to the worker (/api/gazette), where Muse Spark 1.3 on the Meta
// Model API writes three headlines, cached per room and day so every player reads the same paper. A player who hosts
// no villager only asks for that paper. Cloud off, or no paper after a few tries: the rules write the headlines here,
// from the same notes.
import { rulesHeadlines } from "../mind/gazette";
import { CLOUD_LIVELY } from "./test-mode";

export interface Paper {
  day: number;
  headlines: string[];
  by: string; // who wrote it, shown under the headlines
}

export interface GazetteSource {
  room(): string; // "main", "main-2", ...
  hosts(): boolean; // this client runs at least one villager's mind
  notes(day: number): string[]; // what the villagers it runs noted that day
  prices(): string[]; // "fish 4c"
}

export const RULES_BY = "the villagers' own notes (rules)";
export const byLabel = (model?: string): string =>
  !model || model === "mock" ? RULES_BY : /muse-spark-1/.test(model) ? "Muse Spark 1.3 (Meta Model API)" : /spark-open/.test(model) ? "Muse Spark Open (Baseten)" : model.slice(0, 32);

const WAIT_MS = 30_000; // Muse Spark reasons briefly first (~5 s)
const RETRY_MS = 15_000; // a reader waits for the host's paper; a busy writer frees the day after a minute
const TRIES = 4;
const START_MS = 4_000; // a new day: let the minds settle, the room hand over hosts, the first hints show

interface Answer {
  headlines: string[];
  model?: string;
  why?: string;
}

export async function fetchGazette(ask: { room: string; day: number; events: string[]; prices: string[] }, fetchFn: typeof fetch = (i, o) => fetch(i, o)): Promise<Answer> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), WAIT_MS);
  try {
    const res = await fetchFn("/api/gazette", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(ask), signal: ctl.signal });
    if (!res.ok) return { headlines: [], why: `status ${res.status}` };
    const b = (await res.json()) as { headlines?: unknown; model?: unknown; why?: unknown };
    const headlines = Array.isArray(b.headlines) ? b.headlines.filter((h): h is string => typeof h === "string").map((h) => h.replace(/[^\p{L}\p{N} ,.:;!?'()%+-]+/gu, "").slice(0, 70)).filter((h) => h.length >= 8).slice(0, 3) : [];
    return { headlines, ...(typeof b.model === "string" ? { model: b.model } : {}), ...(typeof b.why === "string" ? { why: b.why } : {}) };
  } catch {
    return { headlines: [], why: "offline" };
  } finally {
    clearTimeout(timer);
  }
}

export class Gazette {
  paper: Paper | null = null;
  private day = -1;
  private tries = 0;
  private nextAt = 0;
  private asking = false;
  private now = 0;

  constructor(
    private readonly src: GazetteSource,
    private readonly onPaper: (p: Paper) => void,
    private readonly fetchFn: typeof fetch = (i, o) => fetch(i, o),
    private readonly cloud = CLOUD_LIVELY,
  ) {}

  // Every frame: `day` = today's game day, `nowMs` = real time.
  update(day: number, nowMs: number): void {
    this.now = nowMs;
    if (day !== this.day) Object.assign(this, { day, paper: null, tries: 0, nextAt: nowMs + START_MS });
    if (this.paper || this.asking || nowMs < this.nextAt) return;
    void this.ask(day);
  }

  private done(day: number, headlines: string[], by: string): void {
    if (day !== this.day || !headlines.length) return;
    this.paper = { day, headlines, by };
    this.onPaper(this.paper);
  }

  private async ask(day: number): Promise<void> {
    const notes = this.src.hosts() ? this.src.notes(day - 1) : [];
    const prices = this.src.prices();
    if (!this.cloud) return this.done(day, rulesHeadlines(notes, prices), RULES_BY);
    this.asking = true;
    const r = await fetchGazette({ room: this.src.room(), day, events: notes, prices }, this.fetchFn);
    this.asking = false;
    if (r.headlines.length) return this.done(day, r.headlines, byLabel(r.model));
    this.tries++;
    // Nothing more will come today (a cap, no service, a bad ask), or we waited enough: the rules write it.
    const final = this.tries >= TRIES || (r.why !== undefined && !["empty", "busy", "offline", "upstream", "invalid", "truncated"].includes(r.why));
    if (final) return this.done(day, rulesHeadlines(this.src.hosts() ? this.src.notes(day - 1) : notes, prices), RULES_BY);
    this.nextAt = this.now + RETRY_MS;
  }
}

// The paper as menu rows on the town board: a heading, then each headline wrapped to `width` characters.
export function paperRows(p: Paper | null, width: number): { label: string }[] {
  if (!p) return [{ label: "Gazette: at the press..." }];
  const rows = [{ label: `GAZETTE  day ${p.day}` }];
  for (const h of p.headlines) {
    let line = "-";
    for (const w of h.split(" ")) {
      if (line.length + 1 + w.length > width && line.length > 1) {
        rows.push({ label: line });
        line = " ";
      }
      line += ` ${w}`;
    }
    rows.push({ label: line });
  }
  return rows;
}
