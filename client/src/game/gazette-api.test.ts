import { describe, expect, it } from "vitest";
import { byLabel, Gazette, paperRows, RULES_BY, type GazetteSource, type Paper } from "./gazette-api";

const SRC = (hosts = true): GazetteSource => ({
  room: () => "main",
  hosts: () => hosts,
  notes: (day) => (day === 9 ? ["Pip: saved up and bought a ball"] : []),
  prices: () => ["fish 4c"],
});
const reply = (b: unknown) => async () => new Response(JSON.stringify(b), { status: 200 });
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("Village Gazette on the client", () => {
  it("the host sends yesterday's notes once the day settles, and shows Muse Spark's paper", async () => {
    const sent: unknown[] = [];
    const papers: Paper[] = [];
    const fetchFn = (async (_u: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      return reply({ headlines: ["Pip Buys a Ball!", "Fish Holds at 4c", "Sunny Skies Ahead"], model: "muse-spark-1.3", source: "model" })();
    }) as unknown as typeof fetch;
    const gz = new Gazette(SRC(), (p) => papers.push(p), fetchFn, true);
    gz.update(10, 0);
    expect(sent).toHaveLength(0); // the day just turned: wait for the minds and hosts
    gz.update(10, 5000);
    await tick();
    expect(sent).toEqual([{ room: "main", day: 10, events: ["Pip: saved up and bought a ball"], prices: ["fish 4c"] }]);
    expect(papers).toEqual([{ day: 10, headlines: ["Pip Buys a Ball!", "Fish Holds at 4c", "Sunny Skies Ahead"], by: "Muse Spark 1.3 (Meta Model API)" }]);
    gz.update(10, 9000);
    await tick();
    expect(sent).toHaveLength(1); // one paper a day
  });

  it("a player who hosts no villager only asks, waits for the host's paper, then falls back to rules", async () => {
    const sent: { events: string[] }[] = [];
    const fetchFn = (async (_u: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      return reply({ headlines: [], source: "none", why: "empty" })();
    }) as unknown as typeof fetch;
    const gz = new Gazette(SRC(false), () => {}, fetchFn, true);
    for (let s = 0; s < 120; s += 5) {
      gz.update(10, s * 1000);
      await tick();
    }
    expect(sent.length).toBe(4);
    expect(sent.every((b) => b.events.length === 0)).toBe(true);
    expect(gz.paper?.by).toBe(RULES_BY);
  });

  it("cloud off: the rules write the paper from the same notes, with no call", async () => {
    let calls = 0;
    const gz = new Gazette(SRC(), () => {}, (async () => (calls++, new Response("{}"))) as unknown as typeof fetch, false);
    gz.update(10, 0);
    gz.update(10, 5000);
    await tick();
    expect(calls).toBe(0);
    expect(gz.paper).toEqual({ day: 10, headlines: ["Pip saves up and buys a ball at last", "Market today: fish 4c", "Everyone is welcome at the campfire tonight"], by: RULES_BY });
  });

  it("a cap or a bad ask ends the day's asking at once; a new day starts over", async () => {
    let calls = 0;
    const fetchFn = (async () => (calls++, reply({ headlines: [], source: "none", why: "job_cap" })())) as unknown as typeof fetch;
    const gz = new Gazette(SRC(), () => {}, fetchFn, true);
    gz.update(10, 0);
    gz.update(10, 5000);
    await tick();
    expect(gz.paper?.by).toBe(RULES_BY);
    gz.update(11, 6000);
    expect(gz.paper).toBeNull();
    gz.update(11, 11000);
    await tick();
    expect(calls).toBe(2);
  });

  it("names the writer and wraps headlines for the board", () => {
    expect(byLabel("muse-spark-1.3")).toBe("Muse Spark 1.3 (Meta Model API)");
    expect(byLabel("meta-models/muse-spark-open-1026")).toBe("Muse Spark Open (Baseten)");
    expect(byLabel("mock")).toBe(RULES_BY);
    const rows = paperRows({ day: 3, headlines: ["Kai keeps a promise to Ama: the birthday party at the campfire"], by: "x" }, 30);
    expect(rows.map((r) => r.label)).toEqual(["GAZETTE  day 3", "- Kai keeps a promise to Ama:", "  the birthday party at the", "  campfire"]);
    expect(rows.every((r) => r.label.length <= 30)).toBe(true);
    expect(paperRows(null, 30)).toEqual([{ label: "Gazette: at the press..." }]);
  });
});
