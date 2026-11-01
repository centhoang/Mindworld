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
export const HUMAN_ACTIONS = { idle: 9, walk: 8, run: 8, doing: 8, waiting: 9, jump: 9, axe: 10, watering: 5, casting: 15, reeling: 13, caught: 10, dig: 13 } as const;
type Action = keyof typeof HUMAN_ACTIONS;

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

// No native sit/dance/sleep strips: those keep aligned native cells, and drawing does the rest.
export function humanLayers(look: HumanLook, pose: Pose | null, walking: boolean, running = false, clock = 0): { action: Action; frame?: number; files: string[] } {
  const work = !walking && pose ? workFrame(pose, clock) : null;
  let action: Action = work?.action ?? "idle";
  if (walking) action = running ? "run" : "walk";
  else if (pose === "sleep" || pose === "sit" || pose === "squat") action = "waiting";
  else if (pose === "dance" || pose === "kick") action = "jump";
  const layers = ["base", look.hair];
  // The waiting tool is a rod: use it only for fishing. Jump needs no tool.
  if (action !== "jump" && (action !== "waiting" || work)) layers.push("tools");
  return { action, frame: work?.frame, files: layers.map(layer => `${layer}_${action}_strip${HUMAN_ACTIONS[action]}.png`) };
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

export class HumanSprites {
  private readonly images = new SpriteImages();

  draw(g: CanvasRenderingContext2D, look: HumanLook, motion: HumanMotion, x: number, y: number, t: number, fallback: () => void): void {
    const clock = motion.walking ? motion.walkTime : motion.pose ? motion.poseTime : t;
    const { action, frame: step, files } = humanLayers(look, motion.pose, motion.walking, motion.running, clock);
    // Request all layers together, and fall back atomically so partial bodies never appear.
    const images = files.map(file => this.images.get(`/art/humans/${file}`));
    if (images.some(image => !image)) return fallback();
    const count = HUMAN_ACTIONS[action];
    const seated = !motion.walking && (motion.pose === "sit" || motion.pose === "sleep");
    const frame = seated ? 0 : step ?? Math.floor(clock / FRAME_SECONDS) % count;
    const dancing = !motion.walking && motion.pose === "dance" && Math.floor(clock / 0.68) % 2 === 1;
    g.save();
    g.imageSmoothingEnabled = false;
    g.translate(Math.round(x), Math.round(y));
    if (seated) {
      // Sitting: the body drops onto the ground and the feet go under it.
      g.beginPath();
      g.rect(-48, -39, 96, 39);
      g.clip();
      g.translate(0, 3);
    }
    if (motion.flip !== dancing) g.scale(-1, 1);
    for (const image of images) g.drawImage(image!, frame * 96, 0, 96, 64, -48, -39, 96, 64);
    g.restore();
  }

  // Asleep in a bed: only the head shows above the blanket.
  drawAsleep(g: CanvasRenderingContext2D, look: HumanLook, x: number, y: number): void {
    const images = ["base", look.hair].map(layer => this.images.get(`/art/humans/${layer}_idle_strip9.png`));
    if (images.some(image => !image)) return;
    for (const image of images) g.drawImage(image!, 40, 20, 16, 10, Math.round(x) - 8, Math.round(y) - 20, 16, 10);
  }
}

export const humanSprites = new HumanSprites();
