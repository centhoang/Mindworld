import { describe, expect, it } from "vitest";
import { HEAR_DIST, Room, TALK_TTL_MS, type Out } from "../src/room";

const send = (r: Room, id: string, m: unknown, now = 0) => r.message(id, JSON.stringify(m), now);
const ids = (out: Out[]) => out.map((o) => (typeof o.to === "object" ? o.to.id : o.to));
const room = () => {
  const r = new Room();
  for (const id of ["a", "b", "c"]) r.join(id, {}, 0);
  return r;
};
const place = (r: Room, id: string, x: number, z: number) => Object.assign(r.peers.get(id)!, { x, z });

describe("chat privacy", () => {
  it("delivers a mind line said to a player to that player alone", () => {
    const r = room();
    const out = send(r, "a", { t: "mind", who: "Mochi", say: "just for you", to: "b" }).out;
    expect(ids(out)).toEqual(["b"]);
  });

  it("keeps the public part of a private line for the others", () => {
    const r = room();
    const out = send(r, "a", { t: "mind", who: "Mochi", say: "secret", to: "b", act: "dance" }).out;
    const toC = out.find((o) => typeof o.to === "object" && o.to.id === "c")!.msg;
    expect(toC).toEqual({ t: "mind", id: "a", who: "Mochi", act: "dance" });
    expect(JSON.stringify(toC)).not.toContain("secret");
  });

  it("carries public mind lines to nearby players only, from the speaker's position", () => {
    const r = room();
    place(r, "b", 5, 0);
    place(r, "c", HEAR_DIST + 20, 0);
    expect(ids(send(r, "a", { t: "mind", who: "Mochi", say: "hi", x: 0, z: 0 }).out)).toEqual(["b"]);
    expect(ids(send(r, "a", { t: "mind", who: "Puff", say: "hi", x: HEAR_DIST + 20, z: 0 }).out)).toEqual(["c"]);
  });

  it("always reaches the host of the NPC spoken to, however far", () => {
    const r = room();
    place(r, "b", 100, 100);
    place(r, "c", 100, 100);
    const board = r.board as unknown as { hostOf(n: string): string | null };
    const hostOf = board.hostOf.bind(board);
    board.hostOf = (n) => (n === "mo" ? "c" : n === "pip" ? "a" : hostOf(n));
    expect(ids(send(r, "a", { t: "mind", who: "pip", say: "hey Mo", to: "mo", x: 0, z: 0 }).out)).toEqual(["c"]);
  });

  it("keeps plain room chat public", () => {
    const r = room();
    expect(send(r, "a", { t: "say", text: "hello all" }).out[0]!.to).toBe("near");
  });

  it("sends a player's private line to the other side only, and needs an open chat", () => {
    const r = room();
    expect(send(r, "a", { t: "say", text: "psst", to: "b" }).out[0]).toEqual({ to: "self", msg: { t: "talkNo", with: "b" } });
    send(r, "a", { t: "talk", with: "b" });
    expect(ids(send(r, "a", { t: "say", text: "psst", to: "b" }, 2000).out)).toEqual(["b"]);
    expect(ids(send(r, "b", { t: "say", text: "yes", to: "a" }, 4000).out)).toEqual(["a"]);
  });

  it("marks both sides busy, tells everyone and refuses new chats", () => {
    const r = room();
    const started = send(r, "a", { t: "talk", with: "b" }).out;
    expect(ids(started).sort()).toEqual(["a", "b", "c"]);
    expect(started[0]!.msg).toEqual({ t: "talking", id: "a", with: "b", on: true });
    expect(send(r, "c", { t: "talk", with: "b" }).out).toEqual([{ to: "self", msg: { t: "talkNo", with: "b" } }]);
    expect(send(r, "c", { t: "talk", with: "a" }).out[0]!.msg).toMatchObject({ t: "talkNo" });
    expect(send(r, "b", { t: "talk", with: "c" }).out[0]!.msg).toMatchObject({ t: "talkNo" });
  });

  it("makes an NPC busy too", () => {
    const r = room();
    send(r, "a", { t: "talk", with: "mo" });
    expect(send(r, "b", { t: "talk", with: "mo" }).out[0]!.msg).toEqual({ t: "talkNo", with: "mo" });
    expect(send(r, "b", { t: "talk", with: "pip" }).out[0]!.msg).toMatchObject({ t: "talking", on: true });
  });

  it("ends a chat when either side closes it", () => {
    const r = room();
    send(r, "a", { t: "talk", with: "b" });
    expect(send(r, "b", { t: "talk" }).out[0]!.msg).toEqual({ t: "talking", id: "a", with: "b", on: false });
    expect(send(r, "c", { t: "talk", with: "a" }).out[0]!.msg).toMatchObject({ t: "talking", on: true });
  });

  it("ends a chat on disconnect", () => {
    const r = room();
    send(r, "a", { t: "talk", with: "b" });
    const out = r.leave("b", 1000);
    expect(out.map((o) => o.msg)).toContainEqual({ t: "talking", id: "a", with: "b", on: false });
    expect(send(r, "c", { t: "talk", with: "a" }, 1000).out[0]!.msg).toMatchObject({ t: "talking", on: true });
  });

  it("ends a silent chat after the timeout, and a renewal keeps it open", () => {
    const r = room();
    send(r, "a", { t: "talk", with: "b" });
    send(r, "a", { t: "talk", with: "b" }, TALK_TTL_MS - 1000);
    expect(send(r, "c", { t: "talk", with: "a" }, TALK_TTL_MS + 1000).out[0]!.msg).toMatchObject({ t: "talkNo" });
    const late = send(r, "c", { t: "emote", e: "wave" }, 2 * TALK_TTL_MS + 1000).out;
    expect(late.map((o) => o.msg)).toContainEqual({ t: "talking", id: "a", with: "b", on: false });
  });

  it("shows open chats to a newcomer and refuses junk", () => {
    const r = room();
    send(r, "a", { t: "talk", with: "mo" });
    expect(r.join("d", {}, 0)!.out[0]!.msg).toMatchObject({ t: "welcome", talks: [["a", "mo"]] });
    expect(send(r, "b", { t: "talk", with: "b" }).out).toEqual([]);
    expect(send(r, "b", { t: "talk", with: "nobody" }).out).toEqual([]);
  });
});
