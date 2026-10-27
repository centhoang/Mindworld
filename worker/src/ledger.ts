import type { Provider } from "./pricing";

// Spend ledger: reserve the worst-case cost BEFORE a paid call, settle the real cost after.
// It runs inside one Durable Object. Every check-and-mutate section below is synchronous (no await
// between reading and writing the in-memory state), so concurrent requests cannot interleave and
// overspend; storage writes happen after the mutation and the DO's output gate holds the reply until
// they are flushed.

export interface LedgerStorage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

export interface LedgerLimits {
  dailyUsd: number; // all providers together, per UTC day
  totalUsd: Record<Provider, number>; // per provider, whole event (credits are separate budgets)
  clientDailyUsd: number; // per hashed client, per UTC day
  clientPerMinute: number; // calls per fixed 60 s window per client
  reservationTtlMs: number; // an unsettled reservation is assumed fully spent after this
}

export interface ReserveRequest {
  id: string;
  provider: Provider;
  worstCaseUsd: number;
  clientKey: string;
}

export type RejectReason = "rate_limit" | "client_cap" | "daily_cap" | "total_cap" | "duplicate";
export type ReserveResult = { ok: true } | { ok: false; reason: RejectReason };

export interface SpendSnapshot {
  day: string;
  dailySpentUsd: number;
  dailyReservedUsd: number;
  dailyCapUsd: number;
  totalSpentUsd: Record<Provider, number>;
  totalCapUsd: Record<Provider, number>;
  inflight: number;
  overrunUsd: number;
}

interface Reservation {
  provider: Provider;
  usd: number;
  clientKey: string;
  at: number;
}

interface ClientState {
  spent: number;
  windowStart: number;
  calls: number;
}

interface LedgerState {
  day: string;
  dailySpent: number;
  totalSpent: Record<Provider, number>;
  overrun: number;
  reservations: Record<string, Reservation>;
  clients: Record<string, ClientState>;
}

const STATE_KEY = "ledger";
const MINUTE_MS = 60_000;
const EPS = 1e-9;
const MAX_CLIENTS = 5000;

const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

function freshState(now: number): LedgerState {
  return {
    day: dayOf(now),
    dailySpent: 0,
    totalSpent: { baseten: 0, meta: 0 },
    overrun: 0,
    reservations: {},
    clients: {},
  };
}

export class SpendLedger {
  private state?: LedgerState;
  private loading?: Promise<LedgerState>;

  constructor(
    private readonly storage: LedgerStorage,
    private readonly limits: LedgerLimits,
    private readonly now: () => number = Date.now,
  ) {}

  async reserve(req: ReserveRequest): Promise<ReserveResult> {
    const s = await this.load();
    const now = this.now();
    this.advance(s, now);

    if (s.reservations[req.id]) return { ok: false, reason: "duplicate" };

    const client = this.clientOf(s, req.clientKey, now);
    if (client.calls >= this.limits.clientPerMinute) return { ok: false, reason: "rate_limit" };

    const worst = Math.max(0, req.worstCaseUsd);
    let reservedAll = 0;
    let reservedProvider = 0;
    let reservedClient = 0;
    for (const r of Object.values(s.reservations)) {
      reservedAll += r.usd;
      if (r.provider === req.provider) reservedProvider += r.usd;
      if (r.clientKey === req.clientKey) reservedClient += r.usd;
    }

    if (client.spent + reservedClient + worst > this.limits.clientDailyUsd + EPS) {
      return { ok: false, reason: "client_cap" };
    }
    if (s.dailySpent + reservedAll + worst > this.limits.dailyUsd + EPS) {
      return { ok: false, reason: "daily_cap" };
    }
    if (s.totalSpent[req.provider] + reservedProvider + worst > this.limits.totalUsd[req.provider] + EPS) {
      return { ok: false, reason: "total_cap" };
    }

    s.reservations[req.id] = { provider: req.provider, usd: worst, clientKey: req.clientKey, at: now };
    client.calls += 1;
    await this.persist(s);
    return { ok: true };
  }

  // Convert a reservation into real spend. Returns false when the id is unknown (already settled,
  // released, or expired and booked at worst case), so a late settle can never double count.
  async settle(id: string, actualUsd: number): Promise<boolean> {
    const s = await this.load();
    this.advance(s, this.now());
    const r = s.reservations[id];
    if (!r) return false;
    delete s.reservations[id];
    const actual = Math.max(0, actualUsd);
    this.book(s, r, actual);
    if (actual > r.usd + EPS) s.overrun += actual - r.usd;
    await this.persist(s);
    return true;
  }

  // Drop a reservation without spend (the provider call provably failed before generating anything).
  async release(id: string): Promise<boolean> {
    const s = await this.load();
    this.advance(s, this.now());
    if (!s.reservations[id]) return false;
    delete s.reservations[id];
    await this.persist(s);
    return true;
  }

  async snapshot(): Promise<SpendSnapshot> {
    const s = await this.load();
    this.advance(s, this.now());
    let reserved = 0;
    for (const r of Object.values(s.reservations)) reserved += r.usd;
    return {
      day: s.day,
      dailySpentUsd: round6(s.dailySpent),
      dailyReservedUsd: round6(reserved),
      dailyCapUsd: this.limits.dailyUsd,
      totalSpentUsd: { baseten: round6(s.totalSpent.baseten), meta: round6(s.totalSpent.meta) },
      totalCapUsd: this.limits.totalUsd,
      inflight: Object.keys(s.reservations).length,
      overrunUsd: round6(s.overrun),
    };
  }

  private load(): Promise<LedgerState> {
    if (this.state) return Promise.resolve(this.state);
    this.loading ??= this.storage.get<LedgerState>(STATE_KEY).then((saved) => {
      this.state = saved ?? freshState(this.now());
      return this.state;
    });
    return this.loading;
  }

  private persist(s: LedgerState): Promise<void> {
    return this.storage.put(STATE_KEY, s);
  }

  // UTC day rollover and expiry of stale reservations (booked at worst case: unknown outcome = spent).
  private advance(s: LedgerState, now: number): void {
    const today = dayOf(now);
    if (s.day !== today) {
      s.day = today;
      s.dailySpent = 0;
      s.clients = {};
    }
    for (const [id, r] of Object.entries(s.reservations)) {
      if (now - r.at > this.limits.reservationTtlMs) {
        delete s.reservations[id];
        this.book(s, r, r.usd);
      }
    }
  }

  private book(s: LedgerState, r: Reservation, usd: number): void {
    s.dailySpent += usd;
    s.totalSpent[r.provider] += usd;
    this.clientOf(s, r.clientKey, this.now()).spent += usd;
  }

  private clientOf(s: LedgerState, key: string, now: number): ClientState {
    let c = s.clients[key];
    if (!c) {
      if (Object.keys(s.clients).length >= MAX_CLIENTS) this.pruneClients(s, now);
      c = { spent: 0, windowStart: now, calls: 0 };
      s.clients[key] = c;
    }
    if (now - c.windowStart >= MINUTE_MS) {
      c.windowStart = now;
      c.calls = 0;
    }
    return c;
  }

  private pruneClients(s: LedgerState, now: number): void {
    for (const [k, c] of Object.entries(s.clients)) {
      const idle = now - c.windowStart > 10 * MINUTE_MS;
      if (idle && c.spent === 0) delete s.clients[k];
    }
  }
}
