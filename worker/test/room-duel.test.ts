import { describe, expect, it } from "vitest";
import { cleanSay, DUEL_TTL_MS, Room, SAY_GAP_MS, type Out } from "../src/room";

const memo = { summary: "my name is Alex", rules: [{ if: [{ k: "intent", is: "heavy" }], do: "guard", why: "Alex said so" }] };
const send = (r: Room, id: string, m: unknown, now = 0) => r.message(id, JSON.stringify(m), now);
const to = (out: Out[], id: string) => out.filter((o) => typeof o.to === "object" && o.to.id === id).map((o) => o.msg);

function room() {
  let n = 0;
  const r = new Room(() => (++n % 10) / 10);
  r.join("a", { name: "Ann", genes: { hue: 0.1 } }, 0);
  r.join("b", { name: "Bo", genes: { hue: 0.9 } }, 0);
  r.join("c", { name: "Cy" }, 0);
  return r;
}

describe("duels", () => {
  it("challenge -> accept gives both players the same seed and both rule snapshots (no free text)", () => {
    const r = room();
    const ch = send(r, "a", { t: "duel", to: "b", memo, genes: { hue: 0.1 } }, 100);
    const invite = to(ch.out, "b")[0] as { t: string; duel: string; from: string; name: string };
    expect(invite).toMatchObject({ t: "duel", from: "a", name: "Ann" });
    expect(ch.out).toHaveLength(1); // only the target hears about it
    const acc = send(r, "b", { t: "duelAccept", duel: invite.duel, memo: { rules: [] }, genes: { hue: 0.9 } }, 200);
    const self = acc.out.find((o) => o.to === "self")!.msg;
    expect(to(acc.out, "a")[0]).toEqual(self);
    expect(self).toMatchObject({ t: "duelStart", duel: invite.duel, a: { id: "a", name: "Ann", genes: { hue: 0.1 } }, b: { id: "b", memo: { rules: [] } } });
    expect(typeof (self as { seed: number }).seed).toBe("number");
    expect(JSON.stringify(self)).not.toContain("Alex");
    expect(r.takeDirty()).toEqual(["a"]); // the challenger's pending duel was cleared
    // a second accept of the same duel finds nothing
    expect(send(r, "b", { t: "duelAccept", duel: invite.duel, memo }, 300).out[0]!.msg).toMatchObject({ t: "duelEnd", reason: "gone" });
  });

  it("decline tells the challenger; a stranger cannot accept or decline someone else's duel", () => {
    const r = room();
    const { duel } = to(send(r, "a", { t: "duel", to: "b", memo }).out, "b")[0] as { duel: string };
    expect(send(r, "c", { t: "duelAccept", duel, memo }).out[0]!.msg).toMatchObject({ t: "duelEnd", reason: "gone" });
    expect(send(r, "c", { t: "duelDecline", duel }).out).toEqual([]);
    expect(to(send(r, "b", { t: "duelDecline", duel }).out, "a")[0]).toEqual({ t: "duelEnd", duel, reason: "declined" });
  });

  it("expires after the TTL", () => {
    const r = room();
    const { duel } = to(send(r, "a", { t: "duel", to: "b", memo }).out, "b")[0] as { duel: string };
    expect(send(r, "b", { t: "duelAccept", duel, memo }, DUEL_TTL_MS + 1).out[0]!.msg).toMatchObject({ t: "duelEnd", reason: "gone" });
  });

  it("tells the other side when a duelist leaves", () => {
    const r = room();
    const { duel } = to(send(r, "a", { t: "duel", to: "b", memo }).out, "b")[0] as { duel: string };
    expect(to(r.leave("b"), "a")).toEqual([{ t: "duelEnd", duel, reason: "gone" }]);
    const r2 = room();
    const d2 = (to(send(r2, "a", { t: "duel", to: "b", memo }).out, "b")[0] as { duel: string }).duel;
    expect(to(r2.leave("a"), "b")).toEqual([{ t: "duelEnd", duel: d2, reason: "gone" }]);
  });

  it("rejects bad challenges: self, unknown target, invalid memo, too many invites", () => {
    const r = room();
    for (const bad of [{ t: "duel", to: "a", memo }, { t: "duel", to: "zz", memo }, { t: "duel", to: "b", memo: { rules: [{ if: [], do: "nuke" }] } },
      { t: "duel", to: "b", memo: { rules: Array.from({ length: 9 }, () => memo.rules[0]) } }]) {
      expect(send(r, "a", bad).out).toEqual([]);
    }
    const r2 = room();
    const relayed = Array.from({ length: 6 }, () => send(r2, "a", { t: "duel", to: "b", memo }).out[0]?.msg.t === "duel").filter(Boolean).length;
    expect(relayed).toBeLessThan(6); // each invite costs 5 tokens, so a burst runs dry fast
  });
});

describe("room chat", () => {
  it("relays short clean lines to the others, one per 1.5 s", () => {
    const r = room();
    expect(send(r, "a", { t: "say", text: "  hi   all!  " }, 0).out).toEqual([{ to: "others", msg: { t: "say", id: "a", text: "hi all!" } }]);
    expect(send(r, "a", { t: "say", text: "again" }, 100).out[0]).toMatchObject({ to: "self", msg: { t: "notice" } });
    expect(send(r, "a", { t: "say", text: "again" }, SAY_GAP_MS).out[0]!.to).toBe("others");
  });

  it("caps length, refuses links, masks bad words, drops junk", () => {
    expect(cleanSay("x".repeat(200))).toHaveLength(80);
    for (const link of ["see https://x.y", "go to www.site", "join discord.gg/abc", "visit evil.com now", "dm @someone123"]) expect(cleanSay(link)).toBeNull();
    expect(cleanSay("what the fuck")).toBe("what the ****");
    expect(cleanSay("sh-it happens")).toBe("***** happens");
    expect(cleanSay("<b>hi</b>")).toBe("b hi /b");
    expect(cleanSay("")).toBeNull();
    expect(cleanSay(5)).toBeNull();
    expect(cleanSay("Dick")).toBe("****");
  });
});
