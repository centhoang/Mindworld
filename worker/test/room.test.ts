import { describe, expect, it } from "vitest";
import { cleanGenes, Room, ROOM_MAX_PEERS } from "../src/room";
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

  it("gives out the three corners, then none, and frees a corner on leave", () => {
    const r = new Room();
    for (const id of ["a", "b", "c", "d"]) r.join(id, {}, 0);
    expect([...r.peers.values()].map((p) => p.corner)).toEqual([0, 1, 2, null]);
    expect(r.leave("b")).toEqual([{ to: "others", msg: { t: "leave", id: "b" } }]);
    expect(r.leave("b")).toEqual([]);
    expect(r.join("e", {}, 0)!.peer.corner).toBe(1);
    expect(r.join("f", { name: "" }, 0)!.peer.name).toBe("Visitor");
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
    expect(m.out).toEqual([{ to: "others", msg: { t: "pos", id: "a", x: 3.14, z: -2, px: 2.14, pz: -1 } }]);
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
