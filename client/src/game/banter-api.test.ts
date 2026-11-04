import { describe, expect, it } from "vitest";
import { fetchBanter, type BanterAsk } from "./banter-api";

const ASK: BanterAsk = { kind: "chat", who: ["mo", "ama"], speak: ["mo"], notes: { mo: "caught fish" }, listeners: ["Kai"], place: "the pond", time: "07:10, morning", said: [], lines: 1 };
const reply = (body: unknown, ok = true) => (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

describe("fetchBanter", () => {
  it("keeps the lines of villagers this machine speaks for, cleaned, and names the model", async () => {
    const b = await fetchBanter(ASK, reply({ lines: [{ who: "mo", text: "Fish are biting <b>today</b>!" }, { who: "ama", text: "Not my line to say." }], model: "meta-models/muse-spark-open-1026" }));
    expect(b).toEqual({ lines: [{ who: "mo", text: "Fish are biting btodayb!" }], by: "Muse Spark Open" });
  });

  it("null when the worker sends no lines, an error, or nothing at all", async () => {
    expect(await fetchBanter(ASK, reply({ lines: [], source: "none", why: "job_cap" }))).toBeNull();
    expect(await fetchBanter(ASK, reply({}, false))).toBeNull();
    expect(await fetchBanter(ASK, (async () => { throw new Error("offline"); }) as unknown as typeof fetch)).toBeNull();
  });

  it("gives up after the wait", async () => {
    const never = ((_: unknown, o: RequestInit) => new Promise((_r, rej) => o.signal?.addEventListener("abort", () => rej(new Error("abort"))))) as unknown as typeof fetch;
    expect(await fetchBanter(ASK, never, 10)).toBeNull();
  });
});
