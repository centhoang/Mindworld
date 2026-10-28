import { describe, expect, it } from "vitest";
import { SpendLedger } from "../src/ledger";
import type { Provider } from "../src/pricing";
import { LIMITS, memoryStorage } from "./helpers";

const T0 = Date.parse("2026-10-28T12:00:00Z");
const req = (id: string, usd: number, over: Partial<{ provider: Provider; clientKey: string }> = {}) => ({
  id,
  provider: over.provider ?? ("baseten" as const),
  clientKey: over.clientKey ?? "c1",
  worstCaseUsd: usd,
});

describe("SpendLedger", () => {
  it.each(["modal", "glimmer"] as const)("enforces %s caps after restoring a pre-Modal ledger", async (provider) => {
    const storage = memoryStorage();
    const first = new SpendLedger(storage, LIMITS, () => T0);
    await first.reserve(req("old", 0.1));
    await first.settle("old", 0.1);
    const saved = storage.data.get("ledger") as { totalSpent: Record<string, number> };
    delete saved.totalSpent.modal;
    delete saved.totalSpent.glimmer;
    const second = new SpendLedger(storage, { ...LIMITS, totalUsd: { ...LIMITS.totalUsd, [provider]: 0.5 } }, () => T0);
    expect((await second.snapshot()).totalSpentUsd).toEqual({ baseten: 0.1, meta: 0, modal: 0, glimmer: 0 });
    expect(await second.reserve(req("new", 0.4, { provider }))).toEqual({ ok: true });
    expect(await second.reserve(req("over", 0.2, { provider }))).toEqual({ ok: false, reason: "total_cap" });
    await second.settle("new", 0.4);
    expect((await second.snapshot()).totalSpentUsd[provider]).toBe(0.4);
    expect(await second.reserve(req("over-again", 0.2, { provider }))).toEqual({ ok: false, reason: "total_cap" });
  });

  it("reserves up to the daily cap and refuses beyond it", async () => {
    const l = new SpendLedger(memoryStorage(), LIMITS, () => T0);
    expect((await l.reserve(req("a", 0.6, { clientKey: "x" }))).ok).toBe(true);
    expect(await l.reserve(req("b", 0.6, { clientKey: "y" }))).toEqual({ ok: false, reason: "daily_cap" });
    expect((await l.reserve(req("c", 0.4, { clientKey: "y" }))).ok).toBe(true);
  });

  it("never overspends under heavy concurrency, even with slow storage", async () => {
    const l = new SpendLedger(memoryStorage(2), { ...LIMITS, dailyUsd: 1, clientPerMinute: 1000, clientDailyUsd: 100 }, () => T0);
    const results = await Promise.all(
      Array.from({ length: 60 }, (_, i) => l.reserve(req(`r${i}`, 0.1, { clientKey: `c${i}` }))),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(10);
    const snap = await l.snapshot();
    expect(snap.dailyReservedUsd).toBeLessThanOrEqual(1 + 1e-9);
  });

  it("settle books the real cost and frees the unused part of the reservation", async () => {
    const l = new SpendLedger(memoryStorage(), LIMITS, () => T0);
    await l.reserve(req("a", 0.5));
    expect(await l.settle("a", 0.01)).toBe(true);
    const snap = await l.snapshot();
    expect(snap.dailySpentUsd).toBe(0.01);
    expect(snap.dailyReservedUsd).toBe(0);
    expect(snap.totalSpentUsd.baseten).toBe(0.01);
    expect((await l.reserve(req("b", 0.9, { clientKey: "other" }))).ok).toBe(true);
  });

  it("a second settle or a settle after release cannot double count", async () => {
    const l = new SpendLedger(memoryStorage(), LIMITS, () => T0);
    await l.reserve(req("a", 0.5));
    expect(await l.settle("a", 0.2)).toBe(true);
    expect(await l.settle("a", 0.2)).toBe(false);
    await l.reserve(req("b", 0.5));
    expect(await l.release("b")).toBe(true);
    expect(await l.settle("b", 0.2)).toBe(false);
    expect((await l.snapshot()).dailySpentUsd).toBe(0.2);
  });

  it("books an unsettled reservation at worst case after the TTL", async () => {
    let now = T0;
    const l = new SpendLedger(memoryStorage(), LIMITS, () => now);
    await l.reserve(req("lost", 0.3));
    now += LIMITS.reservationTtlMs + 1;
    const snap = await l.snapshot();
    expect(snap.inflight).toBe(0);
    expect(snap.dailySpentUsd).toBe(0.3);
    expect(await l.settle("lost", 0.01)).toBe(false);
  });

  it("tracks per-provider total budgets separately", async () => {
    const l = new SpendLedger(
      memoryStorage(),
      { ...LIMITS, dailyUsd: 100, clientDailyUsd: 100, totalUsd: { ...LIMITS.totalUsd, baseten: 0.5, meta: 5 } },
      () => T0,
    );
    expect((await l.reserve(req("a", 0.4, { provider: "baseten" }))).ok).toBe(true);
    expect(await l.reserve(req("b", 0.2, { provider: "baseten" }))).toEqual({ ok: false, reason: "total_cap" });
    expect((await l.reserve(req("c", 0.2, { provider: "meta" }))).ok).toBe(true);
  });

  it("limits calls per client per minute and spend per client per day", async () => {
    let now = T0;
    const l = new SpendLedger(memoryStorage(), { ...LIMITS, dailyUsd: 100, clientPerMinute: 2, clientDailyUsd: 0.25 }, () => now);
    expect((await l.reserve(req("a", 0.1))).ok).toBe(true);
    expect((await l.reserve(req("b", 0.1))).ok).toBe(true);
    expect(await l.reserve(req("c", 0.01))).toEqual({ ok: false, reason: "rate_limit" });
    now += 61_000;
    expect(await l.reserve(req("d", 0.1))).toEqual({ ok: false, reason: "client_cap" });
    expect((await l.reserve(req("e", 0.1, { clientKey: "someone-else" }))).ok).toBe(true);
  });

  it("rejects duplicate reservation ids and resets daily counters at UTC midnight", async () => {
    let now = Date.parse("2026-10-28T23:59:00Z");
    const l = new SpendLedger(memoryStorage(), LIMITS, () => now);
    expect((await l.reserve(req("a", 0.9))).ok).toBe(true);
    expect(await l.reserve(req("a", 0.01))).toEqual({ ok: false, reason: "duplicate" });
    await l.settle("a", 0.9);
    now = Date.parse("2026-10-29T00:00:30Z");
    const snap = await l.snapshot();
    expect(snap.day).toBe("2026-10-29");
    expect(snap.dailySpentUsd).toBe(0);
    expect(snap.totalSpentUsd.baseten).toBe(0.9); // event total survives the day change
  });

  it("restores state from storage after the Durable Object restarts", async () => {
    const storage = memoryStorage();
    const first = new SpendLedger(storage, LIMITS, () => T0);
    await first.reserve(req("a", 0.4));
    await first.settle("a", 0.4);
    const second = new SpendLedger(storage, LIMITS, () => T0);
    expect((await second.snapshot()).dailySpentUsd).toBe(0.4);
    expect(await second.reserve(req("b", 0.7, { clientKey: "z" }))).toEqual({ ok: false, reason: "daily_cap" });
  });

  it("records overruns when the real cost exceeds the reservation", async () => {
    const l = new SpendLedger(memoryStorage(), LIMITS, () => T0);
    await l.reserve(req("a", 0.1));
    await l.settle("a", 0.15);
    expect((await l.snapshot()).overrunUsd).toBe(0.05);
  });
});
