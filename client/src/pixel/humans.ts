import type { Pose } from "../life/activities";
import { WALK_SPEED, type Vec } from "../world/movement";
import { SpriteImages } from "./generated-sprites";

export const HAIR = ["bowlhair", "curlyhair", "longhair", "mophair", "shorthair", "spikeyhair"] as const;
type Tool = "hands" | "rod" | "axe" | "watering";
export interface HumanLook { hair: typeof HAIR[number]; tool: Tool }
export const NPC_LOOKS = {
  elder: { hair: "mophair", tool: "watering" },
  mo: { hair: "shorthair", tool: "rod" },
  ama: { hair: "longhair", tool: "hands" },
  pip: { hair: "spikeyhair", tool: "axe" },
} as const satisfies Record<string, HumanLook>;

// The human sim uses this same speed. Keep keyboard and remote walkers at its pace.
export const HUMAN_WALK_SPEED = WALK_SPEED * 0.4;
export const HUMAN_RUN_SPEED = HUMAN_WALK_SPEED * 1.9;
const FRAME_SECONDS = 0.075;
const WORK_SECONDS = 0.1;
export const HUMAN_ACTIONS = { idle: 9, walk: 8, run: 8, doing: 8, waiting: 9, jump: 9, axe: 10, watering: 5, casting: 15, reeling: 13, caught: 10, dig: 13, attack: 10, hurt: 8 } as const;
export type HumanAction = keyof typeof HUMAN_ACTIONS;
type Action = HumanAction;
// Drawn without the tools layer: a jump needs none, and the attack's tool is a sword (a trainer's shout is the bare swing).
const NO_TOOLS: ReadonlySet<Action> = new Set(["jump", "attack"]);
export const humanFiles = (look: HumanLook, action: Action): string[] =>
  ["base", look.hair, ...(NO_TOOLS.has(action) ? [] : ["tools"])].map((layer) => `${layer}_${action}_strip${HUMAN_ACTIONS[action]}.png`);

// Work is a loop of the pack's own strips: [strip, times through].
const WORK: Partial<Record<Pose, readonly (readonly [Action, number])[]>> = {
  fish: [["casting", 1], ["waiting", 4], ["reeling", 2], ["caught", 1]],
  chop: [["axe", 2], ["idle", 1]],
  water: [["watering", 5], ["idle", 1]],
  dig: [["dig", 2], ["watering", 3], ["idle", 1]],
  serve: [["idle", 2], ["doing", 1]],
  sweep: [["doing", 2]],
  cook: [["doing", 2]],
  eat: [["doing", 2]],
  wiggle: [["doing", 2]],
};
const workLength = (pose: Pose) => (WORK[pose] ?? []).reduce((sum, [a, n]) => sum + HUMAN_ACTIONS[a] * n, 0);
// One full round of a job, in seconds.
export const workSeconds = (pose: Pose) => workLength(pose) * WORK_SECONDS;

// The strip and frame `clock` seconds into a pose.
export function workFrame(pose: Pose, clock: number): { action: Action; frame: number } | null {
  const steps = WORK[pose];
  if (!steps) return null;
  let at = Math.floor(clock / WORK_SECONDS) % workLength(pose);
  for (const [action, times] of steps) {
    const span = HUMAN_ACTIONS[action] * times;
    if (at < span) return { action, frame: at % HUMAN_ACTIONS[action] };
    at -= span;
  }
  return null;
}

export function humanLook(name: string): HumanLook {
  let hash = 2166136261;
  for (const c of name) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
  const tools: Tool[] = ["hands", "rod", "axe", "watering"];
  return { hair: HAIR[hash % HAIR.length]!, tool: tools[Math.floor(hash / HAIR.length) % tools.length]! };
}

// The pack has no sit, sleep, dance or kick. A dance is its jump, soccer is its run, and villagers sleep and eat at home, unseen.
export function humanLayers(look: HumanLook, pose: Pose | null, walking: boolean, running = false, clock = 0): { action: Action; frame?: number; files: string[] } {
  const work = !walking && pose ? workFrame(pose, clock) : null;
  let action: Action = work?.action ?? "idle";
  if (walking) action = running ? "run" : "walk";
  else if (pose === "dance") action = "jump";
  else if (pose === "kick") action = "run";
  return { action, frame: work?.frame, files: humanFiles(look, action) };
}

export interface HumanMotion {
  pos: Vec;
  walking: boolean;
  running: boolean;
  dir: 0 | 1 | 2 | 3;
  flip: boolean;
  walkTime: number;
  poseTime: number;
  pose: Pose | null;
}

export function newHumanMotion(pos: Vec): HumanMotion {
  return { pos: { ...pos }, walking: false, running: false, dir: 0, flip: false, walkTime: 0, poseTime: 0, pose: null };
}

// Sample actual movement for every human, including collisions and remote interpolation.
export function stepHumanMotion(m: HumanMotion, pos: Vec, dt: number, pose: Pose | null = null): void {
  const dx = pos.x - m.pos.x, dz = pos.z - m.pos.z;
  const distance = Math.hypot(dx, dz);
  const walking = dt > 0 && distance > dt * 0.01 && distance <= HUMAN_RUN_SPEED * dt * 2 + 0.01;
  m.running = walking && distance > HUMAN_WALK_SPEED * dt * 1.4;
  if (walking) {
    m.dir = Math.abs(dx) > Math.abs(dz) ? dx < 0 ? 1 : 2 : dz < 0 ? 3 : 0;
    if (Math.abs(dx) > 0.0001) m.flip = dx < 0;
    m.walkTime += distance / HUMAN_WALK_SPEED;
  } else m.walkTime = 0;
  m.poseTime = pose === m.pose && !m.walking && !walking ? m.poseTime + dt : 0;
  m.walking = walking;
  m.pose = pose;
  m.pos = { ...pos };
}

// Every strip any look can need, in any pose, walking or not: the whole set, loaded up front.
export const ALL_HUMAN_FILES: readonly string[] = (Object.keys(HUMAN_ACTIONS) as Action[]).flatMap((action) =>
  ["base", "tools", ...HAIR].filter((layer) => !(layer === "tools" && NO_TOOLS.has(action))).map((layer) => `${layer}_${action}_strip${HUMAN_ACTIONS[action]}.png`));

export class HumanSprites {
  private readonly images = new SpriteImages();
  private loading = false;

  // The pack's humans are the only people on this look (bug 44): while a strip is still loading, or retrying after a
  // failed load, the same look stands in its idle strip, and before that nothing is drawn. Never another art set.
  draw(g: CanvasRenderingContext2D, look: HumanLook, motion: HumanMotion, x: number, y: number, t: number): void {
    this.preload();
    const clock = motion.walking ? motion.walkTime : motion.pose ? motion.poseTime : t;
    let { action, frame: step, files } = humanLayers(look, motion.pose, motion.walking, motion.running, clock);
    // All layers together, so partial bodies never appear.
    let images = files.map(file => this.images.get(`/art/humans/${file}`));
    if (images.some(image => !image)) {
      ({ action, files } = humanLayers(look, null, false));
      step = undefined;
      images = files.map(file => this.images.get(`/art/humans/${file}`));
      if (images.some(image => !image)) return;
    }
    const count = HUMAN_ACTIONS[action];
    const frame = step ?? Math.floor(clock / FRAME_SECONDS) % count;
    this.blit(g, images as HTMLImageElement[], frame, x, y, motion.flip, 1);
  }

  // One frame of a strip, outside the overworld (the battle screen's trainers), `scale` screen pixels per art pixel. The
  // same rule as above: a strip still loading shows the idle strip, else nothing.
  drawAction(g: CanvasRenderingContext2D, look: HumanLook, action: Action, frame: number, x: number, y: number, flip: boolean, scale = 1): void {
    this.preload();
    let images = humanFiles(look, action).map((file) => this.images.get(`/art/humans/${file}`));
    if (images.some((image) => !image)) {
      images = humanFiles(look, "idle").map((file) => this.images.get(`/art/humans/${file}`));
      frame = 0;
      if (images.some((image) => !image)) return;
    }
    this.blit(g, images as HTMLImageElement[], frame % HUMAN_ACTIONS[action], x, y, flip, scale);
  }

  private preload(): void {
    if (this.loading) return;
    this.loading = true;
    for (const file of ALL_HUMAN_FILES) this.images.get(`/art/humans/${file}`);
  }

  // x, y: the feet. A frame is 96x64 with the feet at (48, 39).
  private blit(g: CanvasRenderingContext2D, images: readonly HTMLImageElement[], frame: number, x: number, y: number, flip: boolean, scale: number): void {
    g.save();
    g.imageSmoothingEnabled = false;
    g.translate(Math.round(x), Math.round(y));
    g.scale(flip ? -scale : scale, scale);
    for (const image of images) g.drawImage(image, frame * 96, 0, 96, 64, -48, -39, 96, 64);
    g.restore();
  }
}

export const humanSprites = new HumanSprites();
