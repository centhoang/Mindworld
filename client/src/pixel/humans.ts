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
export const HUMAN_ACTIONS = { idle: 9, walk: 8, run: 8, doing: 8, waiting: 9, jump: 9, axe: 10, watering: 5 } as const;
type Action = keyof typeof HUMAN_ACTIONS;

export function humanLook(name: string): HumanLook {
  let hash = 2166136261;
  for (const c of name) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
  const tools: Tool[] = ["hands", "rod", "axe", "watering"];
  return { hair: HAIR[hash % HAIR.length]!, tool: tools[Math.floor(hash / HAIR.length) % tools.length]! };
}

// No native sit/sweep/dance/cook/sleep strips: retain aligned native action cells instead.
export function humanLayers(look: HumanLook, pose: Pose | null, walking: boolean, running = false): { action: Action; files: string[] } {
  let action: Action = "idle";
  if (walking) action = running ? "run" : "walk";
  else if (pose === "sleep" || pose === "sit" || pose === "fish" || pose === "squat") action = "waiting";
  else if (pose === "dance" || pose === "kick") action = "jump";
  else if (pose === "sweep") action = look.tool === "axe" ? "axe" : look.tool === "watering" ? "watering" : "doing";
  else if (pose === "cook" || pose === "eat" || pose === "wiggle") action = "doing";
  const layers = ["base", look.hair];
  // Waiting contains a rod: use it only for fishing, never for sitting/sleeping. Jump needs no tool.
  if (action === "idle" || action === "walk" || action === "run" || action === "doing" || action === "axe" || action === "watering" || (!walking && pose === "fish")) layers.push("tools");
  return { action, files: layers.map(layer => `${layer}_${action}_strip${HUMAN_ACTIONS[action]}.png`) };
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
    const { action, files } = humanLayers(look, motion.pose, motion.walking, motion.running);
    // Request all layers together, and fall back atomically so partial bodies never appear.
    const images = files.map(file => this.images.get(`/art/humans/${file}`));
    if (images.some(image => !image)) return fallback();
    const count = HUMAN_ACTIONS[action];
    const clock = motion.walking ? motion.walkTime : motion.pose ? motion.poseTime : t;
    // The death strip ends in a skull. Rest with a still waiting pose instead.
    const frame = !motion.walking && motion.pose === "sleep" ? 0 : Math.floor(clock / FRAME_SECONDS) % count;
    g.save();
    g.imageSmoothingEnabled = false;
    g.translate(Math.round(x), Math.round(y));
    if (motion.flip) g.scale(-1, 1);
    for (const image of images) g.drawImage(image!, frame * 96, 0, 96, 64, -48, -39, 96, 64);
    g.restore();
  }
}

export const humanSprites = new HumanSprites();
