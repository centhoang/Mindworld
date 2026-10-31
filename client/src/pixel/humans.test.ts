import { readFileSync, readdirSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HAIR, HUMAN_ACTIONS, HUMAN_WALK_SPEED, HumanSprites, humanLayers, humanLook, newHumanMotion, NPC_LOOKS, stepHumanMotion } from "./humans";

afterEach(() => vi.unstubAllGlobals());

describe("shared human layers", () => {
  it("derives stable saved-name looks and fixed NPC work tools", () => {
    expect(humanLook("Visitor")).toEqual(humanLook("Visitor"));
    expect(HAIR).toContain(humanLook("Visitor").hair);
    expect(humanLayers(NPC_LOOKS.pip, "sweep", false)).toEqual({ action: "axe", files: ["base_axe_strip10.png", "spikeyhair_axe_strip10.png", "tools_axe_strip10.png"] });
    expect(humanLayers(NPC_LOOKS.elder, "sweep", false).action).toBe("watering");
    expect(humanLayers(NPC_LOOKS.mo, "fish", false).files).toContain("tools_waiting_strip9.png");
    expect(humanLayers(NPC_LOOKS.ama, "sit", false).files).toEqual(["base_waiting_strip9.png", "longhair_waiting_strip9.png"]);
    expect(humanLayers(NPC_LOOKS.mo, "sleep", false).action).toBe("waiting");
    expect(humanLayers(NPC_LOOKS.mo, "dance", false).action).toBe("jump");
    expect(humanLayers(NPC_LOOKS.ama, "cook", false).action).toBe("doing");
    expect(humanLayers(NPC_LOOKS.pip, "sweep", true).action).toBe("walk");
  });

  it("ships exactly the native files that the renderer can select, at full strip resolution", () => {
    const used = new Set<string>();
    const poses = [null, "stand", "sit", "sweep", "fish", "dance", "cook", "sleep", "eat", "kick", "squat", "wiggle"] as const;
    for (const hair of HAIR) for (const tool of ["hands", "rod", "axe", "watering"] as const) for (const pose of poses) for (const walking of [false, true]) {
      for (const file of humanLayers({ hair, tool }, pose, walking).files) used.add(file);
    }
    const dir = new URL("../../public/art/humans/", import.meta.url);
    expect(readdirSync(dir).sort()).toEqual([...used].sort());
    for (const file of used) {
      const png = readFileSync(new URL(file, dir));
      const [, action, frames] = file.match(/_(\w+)_strip(\d+)\.png$/)!;
      expect(Number(frames)).toBe(HUMAN_ACTIONS[action as keyof typeof HUMAN_ACTIONS]);
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([96 * Number(frames), 64]);
    }
  });

  it("uses the same distance-based facing and frame clock at different update rates", () => {
    const player = newHumanMotion({ x: 0, z: 0 });
    const npc = newHumanMotion({ x: 0, z: 0 });
    stepHumanMotion(player, { x: -HUMAN_WALK_SPEED * 0.15, z: 0 }, 0.15);
    stepHumanMotion(npc, { x: -HUMAN_WALK_SPEED * 0.075, z: 0 }, 0.075);
    stepHumanMotion(npc, player.pos, 0.075);
    expect(npc.walkTime).toBeCloseTo(player.walkTime);
    expect([npc.dir, npc.flip, npc.walking]).toEqual([player.dir, true, true]);
    stepHumanMotion(npc, npc.pos, 0.075);
    expect([npc.walking, npc.flip, npc.walkTime]).toEqual([false, true, 0]);
    stepHumanMotion(npc, { x: 100, z: 100 }, 0.075);
    expect(npc.walking).toBe(false); // relayout/teleport must not spin through walk frames
  });
});

describe("human loading and drawing", () => {
  function setup() {
    const images: { src: string; onload: () => void; onerror: () => void }[] = [];
    vi.stubGlobal("Image", class {
      src = "";
      onload = () => {};
      onerror = () => {};
      constructor() { images.push(this); }
    });
    const g = { save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(), drawImage: vi.fn(), imageSmoothingEnabled: true };
    return { images, g, ctx: g as unknown as CanvasRenderingContext2D, sprites: new HumanSprites(), fallback: vi.fn() };
  }

  it("keeps the current sprite until every layer loads, including permanent failure", () => {
    const { images, g, ctx, sprites, fallback } = setup();
    const m = newHumanMotion({ x: 0, z: 0 });
    const draw = () => sprites.draw(ctx, NPC_LOOKS.mo, m, 10, 20, 0, fallback);
    draw();
    expect(images.map(i => i.src)).toEqual(humanLayers(NPC_LOOKS.mo, null, false).files.map(f => `/art/humans/${f}`));
    images[0]!.onload();
    images[1]!.onload();
    draw();
    images[2]!.onerror();
    draw();
    expect(images).toHaveLength(3);
    expect(fallback).toHaveBeenCalledTimes(3);
    expect(g.drawImage).not.toHaveBeenCalled();
  });

  it("draws synchronized unscaled layers at root (48,39), snapped and mirrored together", () => {
    const { images, g, ctx, sprites, fallback } = setup();
    const m = newHumanMotion({ x: 0, z: 0 });
    stepHumanMotion(m, { x: -HUMAN_WALK_SPEED * 0.15, z: 0 }, 0.15);
    const draw = () => sprites.draw(ctx, NPC_LOOKS.pip, m, 50.2, 60.8, 0, fallback);
    draw();
    images.forEach(i => i.onload());
    draw();
    expect(g.translate).toHaveBeenCalledWith(50, 61);
    expect(g.scale).toHaveBeenCalledWith(-1, 1);
    expect(g.imageSmoothingEnabled).toBe(false);
    expect(g.drawImage).toHaveBeenCalledTimes(3);
    for (const img of images) expect(g.drawImage).toHaveBeenCalledWith(img, 192, 0, 96, 64, -48, -39, 96, 64);
    expect(g.restore).toHaveBeenCalledOnce();
  });

  it("holds a resting waiting frame for sleeping without a rod", () => {
    const { images, g, ctx, sprites, fallback } = setup();
    const m = newHumanMotion({ x: 0, z: 0 });
    m.pose = "sleep";
    sprites.draw(ctx, NPC_LOOKS.ama, m, 0, 0, 100, fallback);
    images.forEach(i => i.onload());
    sprites.draw(ctx, NPC_LOOKS.ama, m, 0, 0, 100, fallback);
    expect(images).toHaveLength(2);
    expect(g.drawImage).toHaveBeenCalledWith(images[0], 0, 0, 96, 64, -48, -39, 96, 64);
  });
});
