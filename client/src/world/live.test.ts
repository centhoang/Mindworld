import { describe, expect, it, vi } from "vitest";
import { dispatch, LiveLink, parsePeer, roomUrl, type LiveHandlers } from "./live";

function handlers() {
  const log: unknown[][] = [];
  const h: LiveHandlers = {
    welcome: (...a) => void log.push(["welcome", ...a]),
    join: (...a) => void log.push(["join", ...a]),
    leave: (...a) => void log.push(["leave", ...a]),
    pos: (...a) => void log.push(["pos", ...a]),
    pose: () => undefined,
    emote: (...a) => void log.push(["emote", ...a]),
    status: (...a) => void log.push(["status", ...a]),
  };
  return { h, log };
}

function fakeSocket() {
  const sent: string[] = [];
  const ws = {
    readyState: 0,
    sent,
    send: (d: string) => void sent.push(d),
    close: vi.fn(),
    onopen: null as ((e: unknown) => void) | null,
    onmessage: null as ((e: { data: unknown }) => void) | null,
    onclose: null as ((e: unknown) => void) | null,
    onerror: null as ((e: unknown) => void) | null,
  };
  return ws;
}

const peer = { id: "a1", name: "Ann", genes: { hue: 0.2 }, x: 1, z: 2, px: 0, pz: 3, corner: 0, seed: 42 };

describe("live messages", () => {
  it("parses peers defensively", () => {
    expect(parsePeer(peer)).toEqual(peer);
    expect(parsePeer({ ...peer, x: 999 })).toBeNull();
    expect(parsePeer({ ...peer, name: "" })).toBeNull();
    expect(parsePeer({ ...peer, corner: 12, seed: -1, genes: null })).toMatchObject({ corner: null, seed: 0, genes: { hue: 0.6 } });
    expect(parsePeer({ ...peer, corner: 11, x: 150 })).toMatchObject({ corner: 11, x: 150 });
  });

  it("dispatches valid messages and ignores the rest", () => {
    const { h, log } = handlers();
    dispatch(JSON.stringify({ t: "welcome", id: "me", corner: 1, peers: [peer, { bad: 1 }], aways: [{ slot: 2, name: "Mo<", seed: 9, ttl: 5000 }, { slot: 40 }] }), h);
    dispatch(JSON.stringify({ t: "join", peer }), h);
    dispatch(JSON.stringify({ t: "pos", id: "a1", x: 1, z: 1, px: 0, pz: 0 }), h);
    dispatch(JSON.stringify({ t: "emote", id: "a1", e: "heart" }), h);
    dispatch(JSON.stringify({ t: "leave", id: "a1" }), h);
    dispatch(JSON.stringify({ t: "full" }), h);
    for (const bad of ["{", JSON.stringify({ t: "pos", id: "a1", x: "1" }), JSON.stringify({ t: "emote", id: "a1", e: "<b>" }), JSON.stringify({ t: "nuke" })]) dispatch(bad, h);
    expect(log.map((l) => l[0])).toEqual(["welcome", "join", "pos", "emote", "leave", "status"]);
    expect(log[0]).toEqual(["welcome", "me", 1, [peer], [{ slot: 2, name: "Mo", seed: 9, ttl: 5000 }], {}, [], undefined]);
  });

  it("passes the room's ball kicks on, in the welcome too, and drops junk", () => {
    const { h, log } = handlers();
    h.ball = (...a) => void log.push(["ball", ...a]);
    const k = { x: 22, z: 2.5, vx: 3, vz: -4, by: "pip", n: 1000, age: 50 };
    dispatch(JSON.stringify({ t: "ball", ...k }), h);
    dispatch(JSON.stringify({ t: "ball", ...k, vx: "fast" }), h);
    dispatch(JSON.stringify({ t: "ball", ...k, n: -1 }), h);
    dispatch(JSON.stringify({ t: "welcome", id: "me", corner: 1, peers: [], aways: [], ball: k, talks: [["a", "b"]] }), h);
    expect(log).toEqual([["ball", k], ["welcome", "me", 1, [], [], {}, [["a", "b"]], k]]);
  });

  it("builds ws/wss urls", () => {
    expect(roomUrl({ protocol: "https:", host: "pets.uryto.dev" })).toBe("wss://pets.uryto.dev/api/room");
    expect(roomUrl({ protocol: "http:", host: "localhost:5173" })).toBe("ws://localhost:5173/api/room");
  });
});

describe("LiveLink", () => {
  it("says hello, then sends positions only when moved and at most 10 Hz", () => {
    const { h, log } = handlers();
    const ws = fakeSocket();
    const link = new LiveLink("ws://x", () => ({ name: "Me", genes: { hue: 0.1 }, x: 0, z: 0, px: 0, pz: 0 }), h, () => ws);
    link.connect();
    expect(link.tick(0, { x: 1, z: 0, px: 0, pz: 0 })).toBe(false); // not open yet
    ws.readyState = 1;
    ws.onopen!({});
    expect(JSON.parse(ws.sent[0]!)).toMatchObject({ t: "hello", name: "Me" });
    expect(log).toContainEqual(["status", "online"]);
    expect(link.tick(1000, { x: 0, z: 0, px: 0, pz: 0 })).toBe(false); // standing still: nothing sent
    expect(link.tick(1000, { x: 1.234, z: 0, px: 0, pz: 0 })).toBe(true);
    expect(link.tick(1050, { x: 2, z: 0, px: 0, pz: 0 })).toBe(false); // too soon
    expect(link.tick(1100, { x: 2, z: 0, px: 0, pz: 0 })).toBe(true);
    expect(JSON.parse(ws.sent.at(-1)!)).toEqual({ t: "pos", x: 2, z: 0, px: 0, pz: 0 });
    let sent = 0;
    for (let t = 2000; t < 3000; t += 16) sent += link.tick(t, { x: t / 1000, z: 0, px: 0, pz: 0 }) ? 1 : 0;
    expect(sent).toBeLessThanOrEqual(10);
    expect(link.emote("wave")).toBe(true);
  });

  it("stops reconnecting when the room is full, and retries after a drop", () => {
    vi.useFakeTimers();
    const { h, log } = handlers();
    const sockets: ReturnType<typeof fakeSocket>[] = [];
    const link = new LiveLink("ws://x", () => ({ name: "Me", genes: {}, x: 0, z: 0, px: 0, pz: 0 }), h, () => {
      const s = fakeSocket();
      sockets.push(s);
      return s;
    });
    link.connect();
    sockets[0]!.readyState = 1;
    sockets[0]!.onopen!({});
    sockets[0]!.onclose!({});
    expect(link.status).toBe("offline");
    vi.advanceTimersByTime(2000);
    expect(sockets).toHaveLength(2);
    sockets[1]!.onmessage!({ data: JSON.stringify({ t: "full" }) });
    sockets[1]!.onclose!({});
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(2);
    expect(log.at(-1)).toEqual(["status", "full"]);
    vi.useRealTimers();
  });
});

describe("live chat + duel messages", () => {
  const memo = { summary: "my name is Alex", rules: [{ if: [{ k: "intent" as const, is: "heavy" as const }], do: "guard" as const, why: "Alex said" }] };

  it("dispatches say / notice / duel / duelStart / duelEnd and ignores malformed ones", () => {
    const got: unknown[] = [];
    const { h } = handlers();
    Object.assign(h, {
      say: (...a: unknown[]) => got.push(["say", ...a]),
      notice: (...a: unknown[]) => got.push(["notice", ...a]),
      duel: (...a: unknown[]) => got.push(["duel", ...a]),
      duelStart: (...a: unknown[]) => got.push(["duelStart", ...a]),
      duelEnd: (...a: unknown[]) => got.push(["duelEnd", ...a]),
    });
    const f = (id: string) => ({ id, name: id, genes: { hue: 0.5 }, memo });
    dispatch(JSON.stringify({ t: "say", id: "a1", text: "hi!" }), h);
    dispatch(JSON.stringify({ t: "say", id: "a1", text: "x".repeat(81) }), h);
    dispatch(JSON.stringify({ t: "notice", text: "Slow down a little." }), h);
    dispatch(JSON.stringify({ t: "duel", duel: "d1", from: "a1", name: "Ann" }), h);
    dispatch(JSON.stringify({ t: "duelStart", duel: "d1", seed: 7, a: f("a1"), b: f("b2") }), h);
    dispatch(JSON.stringify({ t: "duelStart", duel: "d1", seed: -1, a: f("a1"), b: f("b2") }), h);
    dispatch(JSON.stringify({ t: "duelEnd", duel: "d1", reason: "declined" }), h);
    dispatch(JSON.stringify({ t: "duelEnd", duel: "d1", reason: "boom" }), h);
    expect(got.map((g) => (g as unknown[])[0])).toEqual(["say", "notice", "duel", "duelStart", "duelEnd"]);
    expect((got[3] as unknown[])[2]).toBe(7);
  });

  it("queues a mind's spoken lines 3 s apart instead of losing them, skipping stale ones", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { h } = handlers();
    const ws = fakeSocket();
    const link = new LiveLink("ws://x", () => ({ name: "Me", genes: {}, x: 0, z: 0, px: 0, pz: 0 }), h, () => ws);
    link.connect();
    ws.readyState = 1;
    ws.onopen!({});
    const said = () => ws.sent.map((m) => JSON.parse(m)).filter((m) => m.t === "mind" && m.say).map((m) => m.say);
    link.mind({ who: "mo", say: "one" });
    link.mind({ who: "mo", say: "two" });
    link.mind({ who: "pip", say: "pip!" }); // another mind: no wait
    link.mind({ who: "mo", act: "fish" }); // not spoken: goes at once
    expect(said()).toEqual(["one", "pip!"]);
    vi.advanceTimersByTime(3100);
    expect(said()).toEqual(["one", "pip!", "two"]);
    for (const w of ["a", "b", "c", "d", "e"]) link.mind({ who: "ama", say: w });
    vi.advanceTimersByTime(20_000);
    expect(said().filter((x) => x.length === 1)).toEqual(["a", "b", "c", "d", "e"].slice(0, 5).filter((_, i) => i * 3100 <= 12_000));
    vi.useRealTimers();
  });

    it("sends chat and duel messages with rules only (no free text)", () => {
    const { h } = handlers();
    const ws = fakeSocket();
    const link = new LiveLink("ws://x", () => ({ name: "Me", genes: {}, x: 0, z: 0, px: 0, pz: 0 }), h, () => ws);
    expect(link.say("hi")).toBe(false); // offline
    link.connect();
    ws.readyState = 1;
    ws.onopen!({});
    expect(link.say("   ")).toBe(false);
    expect(link.say("  hello   there ")).toBe(true);
    expect(JSON.parse(ws.sent.at(-1)!)).toEqual({ t: "say", text: "hello there" });
    link.challenge("b2", memo, { hue: 0.2 });
    const c = JSON.parse(ws.sent.at(-1)!);
    expect(c).toMatchObject({ t: "duel", to: "b2", genes: { hue: 0.2 }, memo: { summary: "", rules: [{ do: "guard", why: "" }] } });
    expect(JSON.stringify(c)).not.toContain("Alex");
    link.accept("d1", memo, {});
    expect(JSON.parse(ws.sent.at(-1)!)).toMatchObject({ t: "duelAccept", duel: "d1" });
    link.decline("d1");
    expect(JSON.parse(ws.sent.at(-1)!)).toEqual({ t: "duelDecline", duel: "d1" });
  });
});

describe("live minds", () => {
  it("parses mind lines, NPC hosts and NPC state, ignoring junk", () => {
    const got: unknown[] = [];
    const h = {
      welcome: (...a: unknown[]) => void got.push(["welcome", a[4]]),
      join: () => undefined, leave: () => undefined, pos: () => undefined, pose: () => undefined, emote: () => undefined, status: () => undefined,
      mind: (from: string, l: unknown) => void got.push(["mind", from, l]),
      npcHost: (n: string, host: string | null) => void got.push(["host", n, host]),
      npcState: (n: string, log: string[]) => void got.push(["state", n, log]),
    };
    dispatch(JSON.stringify({ t: "welcome", id: "me", corner: 0, peers: [], aways: [], npcs: { elder: "a1", bogus: "x", mo: 5 } }), h);
    dispatch(JSON.stringify({ t: "mind", id: "a1", who: "elder", act: "picnic", say: "Come!", emote: "nope", invite: { act: "picnic", to: "Mo" } }), h);
    dispatch(JSON.stringify({ t: "mind", id: "a1", who: "Mochi" }), h); // says nothing: dropped
    dispatch(JSON.stringify({ t: "npcHost", npc: "mo", host: null }), h);
    dispatch(JSON.stringify({ t: "npcHost", npc: "zed", host: "a1" }), h);
    dispatch(JSON.stringify({ t: "npcState", npc: "pip", log: ["a", 3, "b"] }), h);
    expect(got).toEqual([
      ["welcome", { elder: "a1" }],
      ["mind", "a1", { who: "elder", act: "picnic", say: "Come!", invite: { act: "picnic", to: "Mo" } }],
      ["host", "mo", null],
      ["state", "pip", ["a", "b"]],
    ]);
  });
  it("parses relayed questions, refusals and lines said to someone", () => {
    const got: unknown[] = [];
    const h = {
      welcome: () => undefined, join: () => undefined, leave: () => undefined, pos: () => undefined, pose: () => undefined, emote: () => undefined, status: () => undefined,
      mind: (_f: string, l: unknown) => void got.push(l),
      ask: (...a: unknown[]) => void got.push(["ask", ...a]),
      askNo: (n: string) => void got.push(["no", n]),
    };
    dispatch(JSON.stringify({ t: "ask", npc: "mo", from: "p1", name: "Kai", text: "fish?" }), h);
    dispatch(JSON.stringify({ t: "ask", npc: "boss", from: "p1", text: "hi" }), h);
    dispatch(JSON.stringify({ t: "ask", npc: "pip", from: "p2", name: "Lu", text: "what is that?", scene: "In view: a bench, east." }), h);
    dispatch(JSON.stringify({ t: "askNo", npc: "ama" }), h);
    dispatch(JSON.stringify({ t: "mind", id: "a1", who: "mo", say: "At dawn.", to: "p1" }), h);
    expect(got).toEqual([["ask", "mo", "p1", "Kai", "fish?", undefined], ["ask", "pip", "p2", "Lu", "what is that?", "In view: a bench, east."], ["no", "ama"], { who: "mo", say: "At dawn.", to: "p1" }]);
  });
});
