import { describe, expect, it } from "vitest";
import { cleanCap, HOST_STALE_MS, hostScore, LOG_MAX, NpcBoard, NPCS } from "../src/npc";
import { Room } from "../src/room";

const peers = (...ps: [string, number, boolean][]) => new Map(ps.map(([id, tps, webgpu]) => [id, { id, cap: { tps, webgpu } }]));
const send = (r: Room, id: string, m: unknown, now = 0) => r.message(id, JSON.stringify(m), now);

describe("npc hosts", () => {
  it("scores fast WebGPU players first and spreads the load", () => {
    expect(hostScore({ webgpu: true, tps: 30 }, 0)).toBeGreaterThan(hostScore({ webgpu: false, tps: 100 }, 0));
    expect(hostScore({ webgpu: true, tps: 30 }, 1)).toBeLessThan(hostScore({ webgpu: true, tps: 30 }, 0));
    expect(hostScore({ webgpu: false, tps: 0 }, 0)).toBeGreaterThan(0); // everyone can host
    expect(cleanCap({ tps: 9999, webgpu: "yes" })).toEqual({ tps: 500, webgpu: false });
  });

  it("gives every NPC a host, balanced, and moves them when the host leaves", () => {
    const b = new NpcBoard();
    const ps = peers(["a", 20, true]);
    expect(b.elect(ps, 0, true).map((c) => c.host)).toEqual(["a", "a", "a", "a"]);
    ps.set("b", { id: "b", cap: { tps: 25, webgpu: true } });
    b.elect(ps, 0, true);
    const count = (id: string) => NPCS.filter((n) => b.hostOf(n) === id).length;
    expect([count("a"), count("b")]).toEqual([2, 2]);
    ps.delete("a");
    b.elect(ps, 1, true);
    expect(count("b")).toBe(4);
    ps.delete("b");
    expect(b.elect(ps, 2, true).every((c) => c.host === null)).toBe(true);
  });

  it("moves NPCs off a host that went quiet, unless nobody else is there", () => {
    const b = new NpcBoard();
    const ps = peers(["a", 50, true]);
    b.elect(ps, 0);
    expect(b.elect(ps, HOST_STALE_MS + 1)).toEqual([]); // alone: keeps them
    ps.set("b", { id: "b", cap: { tps: 1, webgpu: false } });
    b.beat("a", HOST_STALE_MS + 1);
    expect(b.elect(ps, HOST_STALE_MS + 2)).toEqual([]);
    expect(b.elect(ps, 2 * HOST_STALE_MS + 5).map((c) => c.host)).toEqual(["b", "b", "b", "b"]);
  });

  it("keeps a capped memory log per NPC and restores it, dropping junk", () => {
    const b = new NpcBoard();
    for (let i = 0; i < LOG_MAX + 5; i++) b.remember("elder", `line ${i}`);
    expect(b.log("elder")).toHaveLength(LOG_MAX);
    expect(b.log("elder")[0]).toBe("line 5");
    const c = new NpcBoard();
    c.restore({ ...b.snapshot(), mo: ["hi <b>", 5, ""], bogus: ["x"] });
    expect(c.log("elder")).toEqual(b.log("elder"));
    expect(c.log("mo")).toEqual(["hi b"]);
  });
});

describe("room minds", () => {
  const room = () => {
    const r = new Room();
    r.join("a", { cap: { tps: 40, webgpu: true } }, 0);
    r.join("b", { cap: { tps: 10, webgpu: false } }, 0);
    return r;
  };

  it("relays what the asker sees with the question, cleaned (no links)", () => {
    const r = room();
    const host = r.board.hostOf("mo")!;
    const asker = host === "a" ? "b" : "a";
    const out = send(r, asker, { t: "ask", npc: "mo", text: "what's that?", scene: "At the pond, noon.\nIn view: a bench, east." }, 0).out;
    expect(out[0]!.msg).toMatchObject({ t: "ask", npc: "mo", scene: "At the pond, noon. In view: a bench, east." });
    const linky = send(r, asker, { t: "ask", npc: "mo", text: "and that?", scene: "go to www.example.com" }, 5000).out;
    expect(linky[0]!.msg).not.toHaveProperty("scene");
  });

  it("relays a question to the NPC's host when it has a model, else says no at once", () => {
    const r = room();
    const host = r.board.hostOf("mo")!;
    const asker = host === "a" ? "b" : "a";
    expect(send(r, asker, { t: "ask", npc: "mo", text: "where do you fish?" }, 0).out).toEqual([{ to: { id: host }, msg: { t: "ask", npc: "mo", from: asker, name: expect.any(String), text: "where do you fish?" } }]);
    expect(send(r, asker, { t: "ask", npc: "mo", text: "again?" }, 1000).out[0]!.msg).toEqual({ t: "askNo", npc: "mo" }); // too soon
    expect(send(r, host, { t: "ask", npc: "mo", text: "me?" }, 5000).out[0]!.msg).toEqual({ t: "askNo", npc: "mo" }); // I host it
    for (const p of r.peers.values()) p.cap = { tps: 0, webgpu: false }; // nobody has a model loaded
    expect(send(r, asker, { t: "ask", npc: "mo", text: "hello" }, 9000).out.map((o) => o.msg)).toContainEqual({ t: "askNo", npc: "mo" });
    expect(send(r, asker, { t: "ask", npc: "boss", text: "hi" }, 9500).out.some((o) => o.msg.t === "ask")).toBe(false); // not an NPC
    const line = send(r, host, { t: "mind", who: "mo", say: "At dawn, by the pond.", to: asker }, 10000);
    expect(line.out[0]!.msg).toMatchObject({ t: "mind", who: "mo", say: "At dawn, by the pond.", to: asker });
  });

  it("moves NPCs to a player who loads a model, and keeps them off players without one", () => {
    const r = new Room();
    r.join("a", { cap: { tps: 0, webgpu: true } }, 0);
    r.join("b", { cap: { tps: 0, webgpu: true } }, 0);
    expect(NPCS.filter((n) => r.board.hostOf(n) === "a")).toHaveLength(2);
    const res = send(r, "b", { t: "cap", tps: 25, webgpu: true }, 1000); // b loaded Llama
    expect(NPCS.every((n) => r.board.hostOf(n) === "b")).toBe(true);
    expect(res.out.filter((o) => o.msg.t === "npcHost")).not.toHaveLength(0);
    r.join("c", { cap: { tps: 0, webgpu: false } }, 2000); // no model: balancing gives it nothing
    expect(NPCS.every((n) => r.board.hostOf(n) === "b")).toBe(true);
    r.join("d", { cap: { tps: 20, webgpu: true } }, 3000); // a second model holder shares the load
    expect(NPCS.filter((n) => r.board.hostOf(n) === "d")).toHaveLength(2);
  });

  it("town board trades reach everyone and stay out of the NPC's log; only the latest purse is kept", () => {
    const r = new Room();
    r.join("a", {}, 0);
    r.join("b", {}, 0);
    const out = send(r, "a", { t: "mind", who: "pip", mem: "trade|Pip|wood|2|5" })!;
    expect(out.out.map((o) => (o.msg as { trade?: string }).trade)).toEqual(["trade|Pip|wood|2|5"]);
    send(r, "a", { t: "mind", who: "pip", mem: "purse|15|||" });
    send(r, "a", { t: "mind", who: "pip", mem: "08:00 woke up" });
    send(r, "a", { t: "mind", who: "pip", mem: "purse|20|||" });
    const log = r.board.log("pip");
    expect(log).toEqual(["08:00 woke up", "purse|20|||"]);
  });

  it("tells a newcomer who hosts which NPC and hands the new host the NPC's memory", () => {
    const r = new Room();
    const ja = r.join("a", {}, 0)!;
    expect(ja.out[0]!.msg).toMatchObject({ t: "welcome", npcs: { elder: "a", mo: "a", ama: "a", pip: "a" } });
    expect(ja.out.filter((o) => o.msg.t === "npcState")).toHaveLength(4);
    send(r, "a", { t: "mind", who: "elder", mem: "Ann likes fish" });
    const jb = r.join("b", {}, 0)!;
    const moved = jb.out.filter((o) => o.msg.t === "npcHost").map((o) => o.msg);
    expect(moved).toHaveLength(2);
    const st = jb.out.find((o) => o.msg.t === "npcState" && o.msg.npc === "elder");
    if (st) expect(st).toEqual({ to: { id: "b" }, msg: { t: "npcState", npc: "elder", log: ["Ann likes fish"] } });
  });

  it("relays a pet's or a hosted NPC's line, and refuses to let others speak for an NPC", () => {
    const r = room();
    const elderHost = r.board.hostOf("elder")!;
    const other = elderHost === "a" ? "b" : "a";
    const ok = send(r, elderHost, { t: "mind", who: "elder", act: "picnic", say: "Picnic at noon!", invite: { act: "picnic", to: "Mo" } });
    expect(ok.out[0]!.msg).toEqual({ t: "mind", id: elderHost, who: "elder", act: "picnic", say: "Picnic at noon!", invite: { act: "picnic", to: "Mo" } });
    expect(send(r, other, { t: "mind", who: "elder", say: "I am the elder now" }).out).toEqual([]);
    expect(r.peers.get(other)!.strikes).toBe(1);
    expect(send(r, other, { t: "mind", who: "Mochi", emote: "heart" }).out[0]!.msg).toEqual({ t: "mind", id: other, who: "Mochi", emote: "heart" });
    for (const bad of [{ who: "Mochi", act: "rob" }, { who: "Mochi", emote: "x" }, { who: "", say: "hi" }, { who: "Mochi", mem: "pets can't" }, { who: "Mochi", invite: { act: "nope" } }])
      expect(send(r, other, { t: "mind", ...bad }).out).toEqual([]);
  });

  it("keeps a mind to one line per 3 s and drops links", () => {
    const r = room();
    expect(send(r, "a", { t: "mind", who: "Mochi", say: "hello" }, 0).out).toHaveLength(1);
    expect(send(r, "a", { t: "mind", who: "Mochi", say: "again" }, 1000).out).toEqual([]);
    expect(send(r, "a", { t: "mind", who: "Puff", say: "me too" }, 1000).out).toHaveLength(1); // another mind
    expect(send(r, "a", { t: "mind", who: "Mochi", say: "see www.x.com" }, 4000).out).toEqual([]);
    expect(send(r, "a", { t: "mind", who: "Mochi", say: "now ok" }, 4000).out).toHaveLength(1);
  });

  it("takes cap at most every 10 s as the host heartbeat, and re-elects when a host goes quiet", () => {
    const r = room();
    const host = r.board.hostOf("elder")!;
    const other = host === "a" ? "b" : "a";
    send(r, host, { t: "cap", tps: 80, webgpu: true }, 1000);
    expect(r.peers.get(host)!.cap.tps).toBe(80);
    send(r, host, { t: "cap", tps: 5, webgpu: true }, 2000);
    expect(r.peers.get(host)!.cap.tps).toBe(80);
    // Only the other player keeps talking: after 15 s the quiet host's NPCs move, and both sides hear it.
    send(r, other, { t: "cap", tps: 10 }, 12_000);
    const res = send(r, other, { t: "cap", tps: 10 }, 30_000);
    const hosts = res.out.filter((o) => o.msg.t === "npcHost");
    expect(hosts.length).toBeGreaterThan(0);
    expect(hosts.some((o) => o.to === "self") && hosts.some((o) => o.to === "others")).toBe(true);
    expect(NPCS.every((n) => r.board.hostOf(n) === other)).toBe(true);
  });
});
