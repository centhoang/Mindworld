import { readFileSync, readdirSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Pose } from "../life/activities";
import { ALL_HUMAN_FILES, HAIR, HUMAN_ACTIONS, workSeconds, HUMAN_WALK_SPEED, HumanSprites, humanFiles, humanLayers, humanLook, newHumanMotion, NPC_LOOKS, stepHumanMotion } from "./humans";

afterEach(() => vi.unstubAllGlobals());

describe("shared human layers", () => {
  it("derives stable saved-name looks and fixed NPC work tools", () => {
    expect(humanLook("Visitor")).toEqual(humanLook("Visitor"));
    expect(HAIR).toContain(humanLook("Visitor").hair);
    expect(humanLayers(NPC_LOOKS.pip, "chop", false).files).toEqual(["base_axe_strip10.png", "spikeyhair_axe_strip10.png", "tools_axe_strip10.png"]);
    expect(humanLayers(NPC_LOOKS.elder, "water", false).action).toBe("watering");
    expect(humanLayers(NPC_LOOKS.mo, "fish", false).action).toBe("casting");
    expect(humanLayers(NPC_LOOKS.mo, "fish", false, false, 2).files).toContain("tools_waiting_strip9.png");
    expect(humanLayers(NPC_LOOKS.mo, "fish", false, false, workSeconds("fish") - 0.05).action).toBe("caught");
    expect(humanLayers(NPC_LOOKS.pip, "kick", false).action).toBe("idle"); // waits for the ball; it runs when it moves
    expect(humanLayers(NPC_LOOKS.pip, "kick", true, true).action).toBe("run");
    expect(humanLayers(NPC_LOOKS.mo, "dance", false).action).toBe("jump");
    expect(humanLayers(NPC_LOOKS.ama, "cook", false).action).toBe("doing");
    expect(humanLayers(NPC_LOOKS.pip, "sweep", true).action).toBe("walk");
  });

  it("ships exactly the native files that the renderer can select, at full strip resolution", () => {
    const used = new Set<string>();
    const poses = [null, "stand", "sit", "sweep", "fish", "dance", "cook", "sleep", "eat", "kick", "squat", "wiggle", "chop", "water", "dig", "serve", "carry", "hammer", "mine", "warm", "feed", "swim"] as const;
    const clocks = [0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    for (const hair of HAIR) for (const tool of ["hands", "rod", "axe", "watering"] as const) for (const pose of poses) for (const walking of [false, true]) {
      for (const running of [false, true]) for (const clock of clocks) for (const file of humanLayers({ hair, tool }, pose, walking, running, clock).files) used.add(file);
    }
    // The battle screen's trainers (pixel/battle.ts): idle, the shout's swing, the hurt flinch, the win jump.
    for (const hair of HAIR) for (const action of ["idle", "attack", "hurt", "jump"] as const) for (const file of humanFiles({ hair, tool: "hands" }, action)) used.add(file);
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
    const g = { save: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(), drawImage: vi.fn(), imageSmoothingEnabled: true };
    return { images, g, ctx: g as unknown as CanvasRenderingContext2D, sprites: new HumanSprites() };
  }

  it("loads the whole Sunnyside set up front and draws nothing else while it loads (bug 44)", () => {
    const { images, g, ctx, sprites } = setup();
    sprites.draw(ctx, NPC_LOOKS.mo, newHumanMotion({ x: 0, z: 0 }), 10, 20, 0);
    expect(images.map(i => i.src)).toEqual(ALL_HUMAN_FILES.map(f => `/art/humans/${f}`));
    expect(g.drawImage).not.toHaveBeenCalled();
  });

  it("stands in the same look's idle strip while a pose's strip is missing, never another art set", () => {
    const { images, g, ctx, sprites } = setup();
    const m = newHumanMotion({ x: 0, z: 0 });
    stepHumanMotion(m, m.pos, 0.1, "fish");
    sprites.draw(ctx, NPC_LOOKS.mo, m, 10, 20, 0);
    const idle = humanLayers(NPC_LOOKS.mo, null, false).files.map(f => `/art/humans/${f}`);
    for (const i of images) if (idle.includes(i.src)) i.onload();
    sprites.draw(ctx, NPC_LOOKS.mo, m, 10, 20, 0);
    expect(g.drawImage).toHaveBeenCalledTimes(3);
    for (const call of g.drawImage.mock.calls) expect(idle).toContain((call[0] as { src: string }).src);
  });

  it("asks again for a strip that failed to load", () => {
    vi.useFakeTimers();
    const { images, ctx, sprites } = setup();
    const m = newHumanMotion({ x: 0, z: 0 });
    sprites.draw(ctx, NPC_LOOKS.mo, m, 10, 20, 0);
    const first = images.length;
    images[0]!.onerror();
    vi.advanceTimersByTime(1500);
    sprites.draw(ctx, NPC_LOOKS.mo, m, 10, 20, 0);
    expect(images.length).toBe(first + 1);
    expect(images.at(-1)!.src).toBe(images[0]!.src);
    vi.useRealTimers();
  });

  it("finds a Sunnyside strip for every pose, walk and run, in every look", () => {
    const files = new Set(readdirSync("public/art/humans"));
    const poses: (Pose | null)[] = [null, "stand", "sleep", "eat", "dance", "kick", "squat", "sit", "fish", "sweep", "wiggle", "cook", "chop", "water", "dig", "serve", "carry", "hammer", "mine", "warm", "feed", "swim"];
    const used = new Set<string>();
    const looks = [...Object.values(NPC_LOOKS), ...HAIR.map(hair => ({ hair, tool: "hands" as const }))];
    for (const look of looks) for (const pose of poses) for (const [walking, running] of [[false, false], [true, false], [true, true]] as const)
      for (let clock = 0; clock < 12; clock += 0.05) for (const f of humanLayers(look, pose, walking, running, clock).files) used.add(f);
    expect([...used].filter(f => !files.has(f) || !ALL_HUMAN_FILES.includes(f))).toEqual([]);
    expect(used.size).toBeGreaterThan(50);
  });

  it("plays the fishing strips (rod and line) only while fishing (bug 53: the campfire drew a rod)", () => {
    const fishing = new Set(["casting", "waiting", "reeling", "caught"]);
    const poses: Pose[] = ["stand", "sleep", "eat", "dance", "kick", "squat", "sit", "sweep", "wiggle", "cook", "chop", "water", "dig", "serve", "carry", "hammer", "mine", "warm", "feed", "swim"];
    for (const pose of poses) for (let clock = 0; clock < 30; clock += 0.05)
      expect(fishing.has(humanLayers(NPC_LOOKS.elder, pose, false, false, clock).action), pose).toBe(false);
  });

  it("draws synchronized unscaled layers at root (48,39), snapped and mirrored together", () => {
    const { images, g, ctx, sprites } = setup();
    const m = newHumanMotion({ x: 0, z: 0 });
    stepHumanMotion(m, { x: -HUMAN_WALK_SPEED * 0.15, z: 0 }, 0.15);
    const draw = () => sprites.draw(ctx, NPC_LOOKS.pip, m, 50.2, 60.8, 0);
    draw();
    images.forEach(i => i.onload());
    draw();
    expect(g.translate).toHaveBeenCalledWith(50, 61);
    expect(g.scale).toHaveBeenCalledWith(-1, 1);
    expect(g.imageSmoothingEnabled).toBe(false);
    expect(g.drawImage).toHaveBeenCalledTimes(3);
    const walk = humanLayers(NPC_LOOKS.pip, null, true).files.map(f => `/art/humans/${f}`);
    for (const img of images.filter(i => walk.includes(i.src))) expect(g.drawImage).toHaveBeenCalledWith(img, 192, 0, 96, 64, -48, -39, 96, 64);
    expect(g.restore).toHaveBeenCalledOnce();
  });

});
