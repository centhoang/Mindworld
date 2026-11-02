import { describe, expect, it } from "vitest";
import { AWAY_MS, cleanGenes, CORNERS, Room, ROOM_MAX_PEERS } from "../src/room";
import { NPCS } from "../src/npc";
import { harness } from "./helpers";

const pos = (x: number, z: number) => JSON.stringify({ t: "pos", x, z, px: x - 1, pz: z + 1 });

describe("live room", () => {
  it("welcomes a player with the others already there, and tells the others", () => {
    const r = new Room();
    r.join("a", { name: "Ann", genes: { hue: 0.3 } }, 0);
    const j = r.join("b", { name: "Bo<script>", genes: { hue: 2, "bad key": 1 } }, 0)!;
    expect(j.peer).toMatchObject({ name: "Boscript", genes: { hue: 1 }, corner: 1 });
    const welcome = j.out.find((o) => o.to === "self")!.msg;
    expect(welcome).toMatchObject({ t: "welcome", id: "b", corner: 1, peers: [{ id: "a", name: "Ann", corner: 0 }] });
    expect(j.out.find((o) => o.to === "others")!.msg).toMatchObject({ t: "join", peer: { id: "b" } });
    expect(JSON.stringify(welcome)).not.toContain("tokens"); // internal fields stay on the server
  });

  it("gives every player a ground slot and frees it once the ghost ground expires", () => {
    const r = new Room();
    for (const id of ["a", "b", "c"]) r.join(id, { groundSeed: id.charCodeAt(0) }, 0);
    expect([...r.peers.values()].map((p) => [p.corner, p.seed])).toEqual([[0, 97], [1, 98], [2, 99]]);
    const out = r.leave("b", 1000);
    expect(out[0]).toEqual({ to: "others", msg: { t: "leave", id: "b" } });
    expect(out[1]!.msg).toEqual({ t: "away", away: { slot: 1, name: "Visitor", seed: 98, ttl: AWAY_MS } });
    expect(r.leave("b")).toEqual([]);
    // While b's ground is a ghost, newcomers skip its slot...
    expect(r.join("d", { groundSeed: 5 }, 2000)!.peer.corner).toBe(3);
    const w = r.join("e", {}, 3000)!.out[0]!.msg;
    expect(w).toMatchObject({ t: "welcome", corner: 4, aways: [{ slot: 1, seed: 98, ttl: AWAY_MS - 2000 }] });
    // ...after it expires the slot is free again.
    expect(r.join("f", { name: "" }, 1000 + AWAY_MS + 1)!.peer).toMatchObject({ corner: 1, name: "Visitor" });
    expect(r.aways).toEqual([]);
  });

  it("gives a returning player their own ghost ground back", () => {
    const r = new Room();
    r.join("a", { groundSeed: 11 }, 0);
    r.join("b", { groundSeed: 22 }, 0);
    r.leave("a", 10);
    r.awaysChanged = false;
    expect(r.join("a2", { groundSeed: 11 }, 20)!.peer.corner).toBe(0);
    expect(r.aways).toEqual([]);
    expect(r.awaysChanged).toBe(true);
  });

  it("takes the ghost ground closest to expiring when every slot is held", () => {
    const r = new Room();
    for (let n = 0; n < CORNERS; n++) r.join(`p${n}`, { groundSeed: n + 1 }, 0);
    r.leave("p5", 100);
    r.leave("p3", 50);
    expect(r.join("x", { groundSeed: 999 }, 200)!.peer.corner).toBe(3);
    expect(r.aways.map((a) => a.slot)).toEqual([5]);
  });

  it("restores stored ghost grounds and drops junk", () => {
    const r = new Room();
    r.restoreAways([{ slot: 2, name: "Mo<b>", seed: 7, until: 99 }, { slot: 99, until: 1 }, null, "x"]);
    expect(r.aways).toEqual([{ slot: 2, name: "Mob", seed: 7, until: 99 }]);
    r.restoreAways("junk");
    expect(r.aways).toHaveLength(1);
  });

  it("is full at the cap", () => {
    const r = new Room();
    for (let i = 0; i < ROOM_MAX_PEERS; i++) expect(r.join(`p${i}`, {}, 0)).not.toBeNull();
    expect(r.join("late", {}, 0)).toBeNull();
  });

  it("relays valid positions and emotes to the others only", () => {
    const r = new Room();
    r.join("a", {}, 0);
    const m = r.message("a", pos(3.14159, -2), 10);
    expect(m.out).toEqual([{ to: "near", msg: { t: "pos", id: "a", x: 3.14, z: -2, px: 2.14, pz: -1 }, key: "pos:a" }]);
    expect(r.peers.get("a")).toMatchObject({ x: 3.14, z: -2 });
    expect(r.message("a", JSON.stringify({ t: "emote", e: "heart" }), 20).out[0]!.msg).toEqual({ t: "emote", id: "a", e: "heart" });
  });

  it("drops invalid input: bad JSON, unknown types, out-of-world or non-numeric coords, huge or binary frames", () => {
    const r = new Room();
    r.join("a", {}, 0);
    for (const bad of ["{", "null", JSON.stringify({ t: "teleport" }), pos(1e6, 0), JSON.stringify({ t: "pos", x: "1", z: 0, px: 0, pz: 0 }),
      JSON.stringify({ t: "pos", x: NaN, z: 0, px: 0, pz: 0 }), JSON.stringify({ t: "emote", e: "<b>" }), "x".repeat(600)]) {
      expect(r.message("a", bad, 0).out).toEqual([]);
    }
    expect(r.message("a", new ArrayBuffer(8), 0).out).toEqual([]);
    expect(r.peers.get("a")).toMatchObject({ x: 0, z: 0.5 });
    expect(r.message("zz", pos(0, 0), 0).close).toBe("unknown");
  });

  it("rate-limits each socket (burst 20, ~12/s) and closes a flooder", () => {
    const r = new Room();
    r.join("a", {}, 0);
    r.join("b", {}, 0);
    let passed = 0;
    for (let i = 0; i < 30; i++) passed += r.message("a", pos(1, 1), 0).out.length;
    expect(passed).toBe(20);
    expect(r.message("b", pos(1, 1), 0).out).toHaveLength(1); // per socket, not per room
    expect(r.message("a", pos(1, 1), 500).out).toHaveLength(1); // refilled
    let closed: string | undefined;
    for (let i = 0; i < 100 && !closed; i++) closed = r.message("a", pos(1, 1), 500).close;
    expect(closed).toBe("rate");
  });

  it("closes a socket that keeps sending garbage", () => {
    const r = new Room();
    r.join("a", {}, 0);
    let closed: string | undefined;
    for (let i = 0; i < 200 && !closed; i++) closed = r.message("a", "nope", i * 1000).close;
    expect(closed).toBe("invalid");
  });

  it("survives hibernation: state restored from attachments", () => {
    const a = new Room();
    const { peer } = a.join("a", { name: "Ann" }, 0)!;
    const b = new Room();
    b.restore(structuredClone(peer));
    expect(b.join("b", {}, 0)!.out[0]!.msg).toMatchObject({ t: "welcome", corner: 1, peers: [{ id: "a", name: "Ann" }] });
  });

  it("cleans genes like ghosts do", () => {
    expect(cleanGenes({ hue: 0.5, size: -1, ok1: 2, "x y": 1, s: "1" })).toEqual({ hue: 0.5, size: 0, ok1: 1 });
    expect(cleanGenes([1])).toEqual({});
  });
});

describe("room route", () => {
  it("needs a websocket upgrade and is geo-blocked like everything else", async () => {
    const h = harness();
    expect((await h.call("/api/room")).status).toBe(426);
    expect((await h.call("/api/room", { headers: { upgrade: "websocket" }, country: "RU" })).status).toBe(451);
    expect((await h.call("/api/room", { headers: { upgrade: "websocket" } })).status).toBe(503);
    let hit = 0;
    h.deps.room = { fetch: async () => (hit++, new Response("ok")) };
    await h.call("/api/room", { headers: { upgrade: "websocket" } });
    expect(hit).toBe(1);
  });
});

describe("area of interest", () => {
  const two = () => {
    const r = new Room();
    r.join("a", { x: 0, z: 0 }, 0);
    r.join("b", { x: 1, z: 0 }, 0);
    return r;
  };
  const kinds = (out: { msg: { t: string } }[]) => out.map((o) => o.msg.t);

  it("hides a newcomer from those too far to see it, each way", () => {
    const r = new Room();
    r.join("a", { x: 0, z: 0 }, 0);
    const j = r.join("far", { x: 100, z: 0 }, 0)!;
    expect(j.out.filter((o) => o.msg.t === "exit").map((o) => o.to)).toEqual(["self", { id: "a" }]);
    expect(j.out.find((o) => o.msg.t === "join")!.to).toBe("others");
  });

  it("walking away and back swaps exit and enter, with the farm", () => {
    const r = two();
    r.message("b", JSON.stringify({ t: "farm", plots: [["wheat", 2]] }), 10);
    const away = r.message("a", pos(100, 0), 2000).out;
    expect(away.filter((o) => o.msg.t === "exit").map((o) => o.to)).toEqual([{ id: "a" }, { id: "b" }]);
    const back = r.message("a", pos(1, 0), 4000).out;
    expect(back.find((o) => o.msg.t === "enter" && JSON.stringify(o.to) === '{"id":"a"}')!.msg).toMatchObject({ peer: { id: "b" }, plots: [["wheat", 2]] });
  });

  it("sends villagers only to those who can see them, and on entering a cell", () => {
    const r = new Room();
    r.join("a", { x: 0, z: 0, cap: { webgpu: true, tps: 50 } }, 0);
    r.join("far", { x: 100, z: 0 }, 0);
    const host = r.board.hostOf("mo")!;
    const list = NPCS.map((n) => [n, 2, 2, "idle", ""]);
    const out = r.message(host, JSON.stringify({ t: "npcs", list }), 10).out;
    expect(out.filter((o) => o.msg.t === "npcs").map((o) => o.to)).toEqual([]); // only "far" could get it, and it is too far
    expect(kinds(r.message("far", pos(1, 1), 2000).out)).toContain("npcs");
  });

  it("forgets a leaver", () => {
    const r = two();
    r.leave("b", 10);
    expect(r.near("a")).toEqual([]);
  });

  it("keeps the crowd's far traffic apart by cell", () => {
    const r = two();
    expect(r.far("a", "pos:b")).toBe(false);
    r.message("b", pos(20, 0), 10);
    expect(r.far("a", "pos:b")).toBe(true);
  });
});
