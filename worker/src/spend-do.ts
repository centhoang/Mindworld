import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env";
import { SpendLedger, type LedgerLimits, type ReserveRequest, type ReserveResult, type SpendSnapshot } from "./ledger";

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(n) && n >= 0 ? n : fallback;
};

export function limitsFromEnv(env: Pick<Env, "MAX_DAILY_USD" | "MAX_TOTAL_USD_BASETEN" | "MAX_TOTAL_USD_META" | "MAX_TOTAL_USD_MODAL" | "MAX_TOTAL_USD_GLIMMER" | "CLIENT_DAILY_USD" | "CLIENT_PER_MINUTE">): LedgerLimits {
  return {
    dailyUsd: num(env.MAX_DAILY_USD, 5),
    totalUsd: {
      baseten: num(env.MAX_TOTAL_USD_BASETEN, 50),
      meta: num(env.MAX_TOTAL_USD_META, 100),
      modal: num(env.MAX_TOTAL_USD_MODAL, 20),
      glimmer: num(env.MAX_TOTAL_USD_GLIMMER, 30),
    },
    clientDailyUsd: num(env.CLIENT_DAILY_USD, 0.4),
    clientPerMinute: num(env.CLIENT_PER_MINUTE, 10),
    reservationTtlMs: 120_000,
  };
}

// The single global spend counter (use idFromName("global")). Methods are called over DO RPC.
export class SpendCounter extends DurableObject<Env> {
  private readonly ledger: SpendLedger;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ledger = new SpendLedger(
      {
        get: <T>(key: string) => ctx.storage.get<T>(key),
        put: <T>(key: string, value: T) => ctx.storage.put(key, value),
      },
      limitsFromEnv(env),
    );
  }

  reserve(req: ReserveRequest): Promise<ReserveResult> {
    return this.ledger.reserve(req);
  }

  settle(id: string, actualUsd: number): Promise<boolean> {
    return this.ledger.settle(id, actualUsd);
  }

  release(id: string): Promise<boolean> {
    return this.ledger.release(id);
  }

  snapshot(): Promise<SpendSnapshot> {
    return this.ledger.snapshot();
  }
}
