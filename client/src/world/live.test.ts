import { describe, expect, it, vi } from "vitest";
import { dispatch, LiveLink, parsePeer, roomUrl, type LiveHandlers } from "./live";

function handlers() {
  const log: unknown[][] = [];
  const h: LiveHandlers = {
    welcome: (...a) => void log.push(["welcome", ...a]),
    join: (...a) => void log.push(["join", ...a]),
    leave: (...a) => void log.push(["leave", ...a]),
    pos: (...a) => void log.push(["pos", ...a]),
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

const peer = { id: "a1", name: "Ann", genes: { hue: 0.2 }, x: 1, z: 2, px: 0, pz: 3, corner: 0 };

describe("live messages", () => {
  it("parses peers defensively", () => {
    expect(parsePeer(peer)).toEqual(peer);
    expect(parsePeer({ ...peer, x: 999 })).toBeNull();
    expect(parsePeer({ ...peer, name: "" })).toBeNull();
    expect(parsePeer({ ...peer, corner: 7, genes: null })).toMatchObject({ corner: null, genes: { hue: 0.6 } });
  });

  it("dispatches valid messages and ignores the rest", () => {
    const { h, log } = handlers();
    dispatch(JSON.stringify({ t: "welcome", id: "me", corner: 1, peers: [peer, { bad: 1 }] }), h);
    dispatch(JSON.stringify({ t: "join", peer }), h);
    dispatch(JSON.stringify({ t: "pos", id: "a1", x: 1, z: 1, px: 0, pz: 0 }), h);
    dispatch(JSON.stringify({ t: "emote", id: "a1", e: "heart" }), h);
    dispatch(JSON.stringify({ t: "leave", id: "a1" }), h);
    dispatch(JSON.stringify({ t: "full" }), h);
    for (const bad of ["{", JSON.stringify({ t: "pos", id: "a1", x: "1" }), JSON.stringify({ t: "emote", id: "a1", e: "<b>" }), JSON.stringify({ t: "nuke" })]) dispatch(bad, h);
    expect(log.map((l) => l[0])).toEqual(["welcome", "join", "pos", "emote", "leave", "status"]);
    expect(log[0]).toEqual(["welcome", "me", 1, [peer]]);
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
