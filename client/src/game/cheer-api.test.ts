import { describe, expect, it } from "vitest";
import { rulesCheer, startWatch, watchLine, watchMemory, type Watcher } from "./cheer-api";
import { noteHeadline } from "../mind/gazette";

const AMA: Watcher = { npc: "ama", name: "Ama", feel: "fond of Kai" };
const FIGHT = { player: "Kai", pet: "Bolt", foe: "a wild Brute", duel: false };
const LINES = { win: "Oh well done, Bolt!", loss: "Come have some soup.", friends: "New friends!" };

describe("a watching villager", () => {
  it("asks for its lines when the fight starts, and says the one for how it ended", async () => {
    const sent: unknown[] = [];
    const fetchFn = (async (_u: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ lines: LINES, source: "model", model: "meta-models/muse-spark-open-1026" }));
    }) as unknown as typeof fetch;
    const w = startWatch(AMA, FIGHT, true, fetchFn)!;
    expect(sent).toEqual([{ npc: "ama", feel: "fond of Kai", player: "Kai", pet: "Bolt", foe: "a wild Brute", duel: false }]);
    expect(await watchLine(w, "loss")).toEqual({ text: "Come have some soup.", by: "Muse Spark Open" });
    expect(await watchLine(w, "friends")).toEqual({ text: "New friends!", by: "Muse Spark Open" });
    expect(await watchLine(w, "draw")).toEqual({ text: rulesCheer("ama", "draw", "Kai", "Bolt"), by: "" });
  });

  it("nobody near: no watcher, no call; cloud off, late or failing: the villager's own line", async () => {
    let calls = 0;
    const counting = (async () => (calls++, new Response("{}"))) as unknown as typeof fetch;
    expect(startWatch(null, FIGHT, true, counting)).toBeNull();
    const off = startWatch(AMA, FIGHT, false, counting)!;
    expect(calls).toBe(0);
    expect(await watchLine(off, "win")).toEqual({ text: "Oh, well done, Bolt! Come by for a treat!", by: "" });
    const slow = startWatch(AMA, FIGHT, true, (() => new Promise(() => {})) as unknown as typeof fetch)!;
    expect((await watchLine(slow, "loss", 20)).text).toBe("Oh, poor Bolt! Come have some soup, Kai.");
    const bad = startWatch(AMA, FIGHT, true, (async () => new Response(JSON.stringify({ lines: { win: "ok!" } }))) as unknown as typeof fetch)!;
    expect((await watchLine(bad, "win")).by).toBe("");
  });

  it("remembers what it saw, and the Gazette can tell it", () => {
    const w = startWatch(AMA, FIGHT, false)!;
    expect(watchMemory(w, "win")).toBe("watched Kai's pet Bolt beat a wild Brute");
    expect(noteHeadline(`Ama: ${watchMemory(w, "win")}`)).toBe("Kai's Bolt beats a wild Brute as Ama watches");
    expect(noteHeadline(`Ama: ${watchMemory(w, "friends")}`)).toBe("Kai's Bolt makes friends with a wild Brute as Ama watches");
  });
});
