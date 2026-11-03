// The seams between scopes (docs/RESTRUCTURE.md step 3). A scope talks to another only through these shapes.
import type { Phase } from "../life/clock";
import type { Pose } from "../life/activities";
import type { Mind } from "../mind/hub";
import type { MindLM } from "../mind/scheduler";
import type { Agent } from "../life/village";
import type { Genes } from "../sim/ghost";
import type { HumanLook } from "../pixel/humans";
import type { Overworld } from "../pixel/overworld";
import type { LiveLink } from "../world/live";
import type { TileMap } from "../world/tilemap";

export interface ScenePerson {
  id: string; // "me", "p:<live id>", or the NPC's id
  name: string;
  kind: "me" | "peer" | "npc";
  x: number;
  z: number;
  dir: 0 | 1 | 2 | 3;
  walking: boolean;
  pose: Pose | null;
  look: HumanLook;
}

export interface ScenePet {
  id: string;
  kind: "mine" | "peer" | "npc" | "resident" | "wild";
  x: number;
  z: number;
  genes: Genes | null; // null: an NPC's pet, which has no genes
  pose: Pose | null;
  hatch?: number; // still an egg: how far along it is, 0 to 1
}

export interface SceneProp {
  kind: string; // tree, house, stall, board, sign, bowl, mess, a decor kind or a spot name
  x: number;
  z: number;
  text?: string;
}

export interface SceneBed {
  x: number;
  z: number;
  crop: string; // "" = bare soil
  stage: number; // 0-3
  wet: boolean;
  dry: boolean; // needs water now
}

export interface SceneBubble {
  id: string;
  x: number;
  z: number;
  head: string;
  text: string;
  thought: boolean;
  first: boolean; // keeps its place when bubbles crowd: mine, or spoken to me
}

export interface SceneInspector {
  mind: Mind;
  agent: Agent;
  rel: Map<string, number>;
  nameOf: (id: string) => string;
  where: string;
  lines: (wrapLine: (s: string) => string[]) => [string, string][]; // [line, colour], ready for any view
}

// A framed list on the plane: goals, a menu, a dialogue or a toast.
export interface ScenePanel {
  place: "corner" | "middle" | "bottom" | "right";
  title: string;
  rows: readonly { label: string; note?: string; ink?: string }[];
  cursor?: number;
  footer?: string;
  width?: number;
}

// What a view needs to draw one frame. A view reads this and never changes the game.
export interface Scene {
  map: TileMap;
  cam: { x: number; z: number };
  indoors: boolean;
  clock: { day: number; hour: number; phase: Phase; label: string };
  day: boolean; // no night tint
  showNames: boolean;
  showMap: boolean;
  people: readonly ScenePerson[];
  pets: readonly ScenePet[];
  props: readonly SceneProp[];
  beds: readonly SceneBed[];
  bubbles: readonly SceneBubble[];
  hint: string | null;
  banner: { text: string; left: number } | null;
  inspector: SceneInspector | null;
  panels: readonly ScenePanel[];
  chips?: readonly { label: string; off: boolean }[]; // the small buttons, on the bottom row of cells
}

// Whether a bubble found room this frame: a held one keeps its time on screen.
export type BubbleFate = readonly [id: string, held: boolean];

export interface SceneFighter {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  genes: Genes | null;
  dx: number; // lunge, in cells
  flash: boolean;
  gone: number; // 0..1 fainting or fleeing
  shield: boolean;
}

export interface SceneBattle {
  foe: SceneFighter | null;
  mine: SceneFighter | null;
  slide: number; // 0..1 the fighters coming in
  hearts: number;
  text: string;
  lines: (width: number) => string[];
  tag: string;
  menu: { labels: readonly string[]; cursor: number } | null;
}

export interface View {
  draw(scene: Scene, g: CanvasRenderingContext2D, w: number, h: number, t: number): BubbleFate[];
  battle?(b: SceneBattle, g: CanvasRenderingContext2D, w: number, h: number, t: number): void;
  wipe?: number; // how far a door has closed the picture, 0 to 1
}

// The part of the live room the game uses. `LiveLink` is the real one; labs pass a fake.
export type Transport = Pick<LiveLink, "status" | "talk" | "tick" | "say" | "rejoin" | "myId" | "decline" | "pose" | "npcs" | "mind" | "farm" | "emote" | "connect" | "challenge" | "cap" | "ask" | "accept">;

export type MindBackend = MindLM;

// What each flow may touch of the world.
export type ChatWorld = Pick<Overworld, "npcs" | "say" | "sceneWithMe" | "wildScene">;
export type RoomWorld = Pick<Overworld, "npcs" | "peers" | "peerFarms" | "me" | "day" | "relayout" | "addPeer" | "movePeer" | "posePeer" | "hearMind" | "say" | "speakerAt" | "onPose" | "onMind" | "onKick" | "ballKicked">;
export type FightWorld = Pick<Overworld, "world" | "removeWild" | "spawnWild" | "cheerPet">;
