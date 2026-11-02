import { describe, expect, it, vi } from "vitest";
import type { Scene, View } from "../game/ports";
import { randomGenes } from "../game/genes";
import { Overworld } from "./overworld";

// Sprites draw to canvases nobody looks at here.
const pen: unknown = new Proxy(() => pen, { get: () => pen, set: () => true, apply: () => pen });
vi.stubGlobal("document", { createElement: () => ({ getContext: () => pen }) });

function world(): Overworld {
  return new Overworld(randomGenes(1), 1);
}

describe("buildScene", () => {
  it("holds me, my pet and the world as plain data", () => {
    const w = world();
    const s = w.buildScene();
    expect(s.people.find((p) => p.id === "me")).toMatchObject({ x: w.player.x, z: w.player.z });
    expect(s.pets.find((p) => p.id === "pet")).toMatchObject({ genes: w.petGenes });
    expect(s.props.some((p) => p.kind === "tree")).toBe(true);
    expect(() => JSON.stringify({ people: s.people, pets: s.pets, props: s.props, beds: s.beds })).not.toThrow();
  });

  it("leaves me and my house out while I am indoors", () => {
    const w = world();
    w.indoors = true;
    const s = w.buildScene();
    expect(s.people.some((p) => p.id === "me")).toBe(false);
    expect(s.props.some((p) => p.kind === "home")).toBe(false);
    expect(s.hint).toBeNull();
  });

  it("a view decides which bubbles are held", () => {
    const w = world();
    let seen: Scene | null = null;
    const view: View = { draw: (scene) => ((seen = scene), [["me", true]]) };
    w.view = view;
    w.say("me", "hello");
    w.draw(null as unknown as CanvasRenderingContext2D, 320, 240, 0);
    expect(seen!.bubbles.map((b) => b.text)).toEqual(["hello"]);
    expect((w as unknown as { bubbles: Map<string, { held: boolean }> }).bubbles.get("me")?.held).toBe(true);
  });
});
