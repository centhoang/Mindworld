// One model per machine serves every mind it hosts. WebLLM runs one request at a time per loaded model, so
// all decisions go through this queue: highest priority first, a deadline per job (late = the scripted or
// utility fallback answers instead) and a duty cap so the game keeps its frame rate and fights keep the GPU.
// No model loaded = every job is answered by its fallback at once ("rules").

import type { LmRequest } from "./brain";

export interface MindLM {
  readonly label: string;
  ready(): boolean;
  complete(req: LmRequest, signal: AbortSignal): Promise<string>;
}

export const PRIO = { talk: 3, choose: 2, emote: 1, plan: 0, reflect: 0 } as const;

export interface Job<T> {
  prio: number;
  timeoutMs: number; // from when it was asked
  req: LmRequest;
  parse: (text: string) => T | null;
  fallback: () => T;
}

export interface Answer<T> {
  value: T;
  source: string; // the model's label, or "rules"
}

interface Queued {
  prio: number;
  deadline: number;
  seq: number;
  run: (lm: MindLM) => Promise<void>;
  expire: () => void;
}

export interface SchedulerStats {
  calls: number;
  fallbacks: number;
  avgMs: number;
  duty: number; // share of the last minute the model was busy with minds
  queued: number;
  label: string;
}

const WINDOW_MS = 60_000;

export class MindScheduler {
  private queue: Queued[] = [];
  private running = false;
  private seq = 0;
  private busy: [number, number][] = []; // [start, end] of recent calls
  private calls = 0;
  private fallbacks = 0;
  private totalMs = 0;
  private speed = 0; // measured tokens/s (smoothed), 0 = no answer yet

  constructor(
    private readonly lm: () => MindLM | null,
    private readonly opts: { duty?: number; now?: () => number; paused?: () => boolean } = {},
  ) {}

  private now(): number {
    return (this.opts.now ?? (() => performance.now()))();
  }

  ask<T>(job: Job<T>): Promise<Answer<T>> {
    return new Promise((resolve) => {
      const fall = () => {
        this.fallbacks++;
        resolve({ value: job.fallback(), source: "rules" });
      };
      if (!this.lm()) return fall();
      const q: Queued = {
        prio: job.prio,
        deadline: this.now() + job.timeoutMs,
        seq: this.seq++,
        expire: fall,
        run: async (lm) => {
          const ctl = new AbortController();
          const left = Math.max(50, q.deadline - this.now());
          const timer = setTimeout(() => ctl.abort(), left);
          const t0 = this.now();
          try {
            // Race the deadline too: a backend that ignores the abort must not hold the mind.
            const late = new Promise<never>((_, rej) => ctl.signal.addEventListener("abort", () => rej(new Error("late"))));
            const text = await Promise.race([lm.complete(job.req, ctl.signal), late]);
            this.measure(job.req, text, this.now() - t0);
            const v = job.parse(text);
            if (v === null) return fall();
            resolve({ value: v, source: lm.label });
          } catch {
            fall();
          } finally {
            clearTimeout(timer);
          }
        },
      };
      this.queue.push(q);
      this.pump();
    });
  }

  // Call every frame (and after each job): expires late jobs, starts the next one when allowed.
  pump(): void {
    const now = this.now();
    for (const q of this.queue.filter((x) => x.deadline <= now)) q.expire();
    this.queue = this.queue.filter((x) => x.deadline > now);
    if (this.running || !this.queue.length) return;
    const lm = this.lm();
    if (!lm) {
      for (const q of this.queue) q.expire();
      this.queue = [];
      return;
    }
    if (!lm.ready() || this.opts.paused?.() || this.duty() > (this.opts.duty ?? 0.7)) return;
    this.queue.sort((a, b) => b.prio - a.prio || a.seq - b.seq);
    const q = this.queue.shift()!;
    this.running = true;
    const start = this.now();
    void q.run(lm).finally(() => {
      const end = this.now();
      this.busy.push([start, end]);
      this.calls++;
      this.totalMs += end - start;
      this.running = false;
      this.pump();
    });
  }

  // Effective speed of the local model for hosting: tokens out plus prompt tokens at a quarter weight
  // (prefill runs ~4x faster than decode), ~4 characters a token, over the call's wall time.
  private measure(req: LmRequest, text: string, ms: number): void {
    if (ms < 50) return;
    const tok = text.length / 4 + (req.system.length + req.user.length) / 16;
    const tps = tok / (ms / 1000);
    this.speed = this.speed ? this.speed * 0.7 + tps * 0.3 : tps;
  }

  // Measured tok/s for the room's host election; `guess` until the first answer (or with no model).
  tps(guess: number): number {
    return this.lm() && this.speed ? Math.round(this.speed) : guess;
  }

  duty(): number {
    const now = this.now();
    this.busy = this.busy.filter(([, e]) => e > now - WINDOW_MS);
    const ms = this.busy.reduce((s, [b, e]) => s + (e - Math.max(b, now - WINDOW_MS)), 0);
    return ms / WINDOW_MS;
  }

  stats(): SchedulerStats {
    return {
      calls: this.calls,
      fallbacks: this.fallbacks,
      avgMs: this.calls ? Math.round(this.totalMs / this.calls) : 0,
      duty: this.duty(),
      queued: this.queue.length,
      label: this.lm()?.label ?? "rules",
    };
  }
}
