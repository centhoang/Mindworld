import * as THREE from "three";
import { makeBossMesh, makeDecor, makeEnemy, makeGhostPet, makePet } from "../game/scene";
import { HOME_SLOTS, slotPosition, type Slot } from "../game/home";
import { ghostHue, type Ghost } from "../sim/ghost";
import type { ArchetypeId } from "../sim/types";
import { walkable, type Platform, type WorldMap } from "./layout";
import { followStep, keyDir, slide, stepToward, WALK_SPEED, type Vec } from "./movement";

// The walkable world: floating islands joined by bridges, the player's avatar, the pet that follows it,
// and the creatures that live on each island. Battles still play in the Arena view; main.ts switches.

export type EntityKind = "wild" | "boss" | "npc" | "market" | "arena" | "ghost" | "tamed";

export interface Entity {
  id: string;
  kind: EntityKind;
  label: string;
  obj: THREE.Group;
  pos: Vec;
  home: Platform;
  archetype?: ArchetypeId;
  ghost?: Ghost;
  wander?: { target: Vec; wait: number; speed: number };
}

export interface WorldContent {
  home: readonly Slot[];
  tamed: readonly ArchetypeId[];
  corners: readonly Ghost[]; // matched to corner platforms by ghost id
}

const mat = (color: number) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85 });

const TOP: Record<Platform["kind"], number> = {
  home: 0x7cc35a, wild: 0x9ccc65, boss: 0x5a4a6e, market: 0xd9b26f, npc: 0x8fbf6a, event: 0x9aa3bd, corner: 0x7cc35a,
};
const WILD_POOL: ArchetypeId[] = ["brute", "skitter", "turtle", "pal", "bully"];

function island(p: Platform): THREE.Group {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r * 0.96, 0.5, 14), mat(TOP[p.kind]));
  top.position.y = -0.25;
  const rock = new THREE.Mesh(new THREE.ConeGeometry(p.r * 0.9, p.r * 1.1, 9), mat(0x7a5a43));
  rock.rotation.x = Math.PI;
  rock.position.y = -0.5 - p.r * 0.55;
  g.add(top, rock);
  g.position.set(p.x, 0, p.z);
  return g;
}

function bridgeMesh(ax: number, az: number, bx: number, bz: number, w: number): THREE.Group {
  const g = new THREE.Group();
  const len = Math.hypot(bx - ax, bz - az);
  const planks = Math.max(2, Math.round(len / 0.55));
  for (let i = 0; i < planks; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.45), mat(i % 2 ? 0xb07d4f : 0xa06d42));
    plank.position.set(0, -0.08, -len / 2 + (i + 0.5) * (len / planks));
    g.add(plank);
  }
  for (const s of [-1, 1]) {
    const rope = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, len), mat(0xe8d6b0));
    rope.position.set((s * w) / 2, 0.45, 0);
    g.add(rope);
  }
  g.position.set((ax + bx) / 2, 0, (az + bz) / 2);
  g.rotation.y = Math.atan2(bx - ax, bz - az);
  return g;
}

export function makeAvatar(robe = 0x5b8def, hat = 0xe06666): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 0.9, 10), mat(robe));
  body.position.y = 0.45;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), mat(0xf1c27d));
  head.position.y = 1.15;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.4, 10), mat(hat));
  cap.position.y = 1.5;
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat(0x222222));
    eye.position.set(s * 0.11, 1.18, 0.26);
    g.add(eye);
  }
  g.add(body, head, cap);
  return g;
}

function house(roof = 0xc0504d): THREE.Group {
  const g = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 1.5), mat(0xf3e3c3));
  walls.position.y = 0.6;
  const top = new THREE.Mesh(new THREE.ConeGeometry(1.45, 0.9, 4), mat(roof));
  top.position.y = 1.65;
  top.rotation.y = Math.PI / 4;
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.65, 0.05), mat(0x7a5a43));
  door.position.set(0, 0.33, 0.76);
  g.add(walls, top, door);
  return g;
}

function stall(): THREE.Group {
  const g = new THREE.Group();
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 0.8), mat(0xa06d42));
  table.position.y = 0.35;
  const awning = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 1.1), mat(0xe06666));
  awning.position.y = 1.7;
  for (const s of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.7), mat(0x7a5a43));
    pole.position.set(s * 0.9, 0.85, 0.4);
    g.add(pole);
  }
  g.add(table, awning);
  return g;
}

function label(text: string): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 96;
  const ctx = c.getContext("2d")!;
  ctx.font = "bold 44px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(20,24,36,0.85)";
  ctx.strokeText(text, 256, 48);
  ctx.fillStyle = "#fff";
  ctx.fillText(text, 256, 48);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  s.scale.set(4, 0.75, 1);
  return s;
}

const randIn = (p: Platform, margin = 1.3): Vec => {
  const a = Math.random() * Math.PI * 2;
  const d = Math.sqrt(Math.random()) * (p.r - margin);
  return { x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d };
};

export class WorldView {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-8, 8, 6, -6, 0.1, 200);
  readonly avatar = makeAvatar();
  readonly pet = makePet();
  entities: Entity[] = [];
  map!: WorldMap;
  onNear: (e: Entity | null) => void = () => {};
  onInteract: (e: Entity) => void = () => {};
  paused = false; // true while a fight or a dialog runs
  private readonly root = new THREE.Group();
  private readonly homeDecor = new THREE.Group();
  private readonly keys = new Set<string>();
  private player: Vec = { x: 0, z: 0.5 };
  private petPos: Vec = { x: -1, z: 2.5 };
  private target: Vec | null = null;
  private targetEntity: Entity | null = null;
  private near: Entity | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private readonly ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private aspect = 16 / 9;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.scene.background = new THREE.Color(0x9fd3f0);
    this.scene.fog = new THREE.Fog(0x9fd3f0, 40, 90);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6a7f99, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.3);
    sun.position.set(6, 12, 8);
    this.scene.add(sun, this.root, this.avatar, this.pet);
    this.pet.scale.setScalar(0.75);
    window.addEventListener("keydown", (e) => this.key(e, true));
    window.addEventListener("keyup", (e) => this.key(e, false));
    window.addEventListener("blur", () => this.keys.clear());
    canvas.addEventListener("pointerdown", (e) => this.click(e));
  }

  build(map: WorldMap, content: WorldContent) {
    this.map = map;
    this.root.clear();
    this.entities = [];
    for (const b of map.bridges) this.root.add(bridgeMesh(b.ax, b.az, b.bx, b.bz, b.w));
    for (const p of map.platforms) {
      this.root.add(island(p));
      const tag = label(p.label);
      tag.position.set(p.x, 3.4, p.z - p.r + 0.6);
      this.root.add(tag);
      this.furnish(p, content);
    }
    this.setHomeDecor(content.home);
    if (!walkable(map, this.player.x, this.player.z)) this.player = { x: 0, z: 0.5 };
  }

  private furnish(p: Platform, content: WorldContent) {
    const at = (obj: THREE.Object3D, dx: number, dz: number) => {
      obj.position.set(p.x + dx, 0, p.z + dz);
      this.root.add(obj);
    };
    switch (p.kind) {
      case "home": {
        const h = house(0x5b8def);
        h.position.set(p.x, 0, p.z - p.r + 1.4);
        this.root.add(h);
        content.tamed.forEach((a, i) => this.spawn({ id: `tamed-${i}`, kind: "tamed", label: `Your ${a}`, archetype: a, home: p, scale: 0.6 }));
        this.root.add(this.homeDecor);
        break;
      }
      case "wild":
        for (let i = 0; i < 2; i++) {
          const a = WILD_POOL[Math.floor(Math.random() * WILD_POOL.length)]!;
          this.spawn({ id: `${p.id}-${i}-${Date.now()}`, kind: "wild", label: `Wild ${a}`, archetype: a, home: p, scale: 0.8 });
        }
        for (let i = 0; i < 4; i++) {
          const v = randIn(p, 0.8);
          const tuft = makeDecor(i % 2 ? "flower" : "rock");
          tuft.position.set(v.x, 0, v.z);
          tuft.scale.setScalar(0.6);
          this.root.add(tuft);
        }
        break;
      case "boss": {
        const e = this.spawn({ id: "boss", kind: "boss", label: "The Reader", home: p, obj: makeBossMesh(), still: true });
        e.pos = { x: p.x, z: p.z - 0.8 };
        break;
      }
      case "npc": {
        const h = house(0x6aa84f);
        at(h, 0, -p.r + 1.3);
        const e = this.spawn({ id: "elder", kind: "npc", label: "Elder Moss", home: p, obj: makeAvatar(0x8a93ad, 0x6aa84f), still: true });
        e.pos = { x: p.x + 0.9, z: p.z + 0.3 };
        break;
      }
      case "market": {
        at(stall(), 0, -0.8);
        const e = this.spawn({ id: "merchant", kind: "market", label: "Merchant", home: p, obj: makeAvatar(0xd9b26f, 0xc0504d), still: true });
        e.pos = { x: p.x, z: p.z - 1.6 };
        break;
      }
      case "event": {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.08, 6, 30), mat(0xffd966));
        ring.rotation.x = Math.PI / 2;
        ring.position.set(p.x, 0.02, p.z);
        this.root.add(ring);
        const e = this.spawn({ id: "arena", kind: "arena", label: "Ghost arena", home: p, obj: makeGhostPet(0.6), still: true });
        e.obj.traverse((o) => {
          if (o instanceof THREE.Mesh) o.material = Object.assign(o.material.clone(), { transparent: true, opacity: 0.55 });
        });
        break;
      }
      case "corner": {
        const g = content.corners.find((c) => c.id === p.owner);
        const h = house(0xc0504d);
        at(h, 0, -p.r + 1.3);
        if (!g) break;
        g.decor.forEach((kind, i) => {
          if (!kind) return;
          const s = slotPosition(i, p.r - 0.8);
          const d = makeDecor(kind);
          d.position.set(p.x + s.x, 0, p.z + s.z);
          this.root.add(d);
        });
        this.spawn({ id: `ghost-${g.id}`, kind: "ghost", label: `${g.name} (ghost)`, ghost: g, home: p, obj: makeGhostPet(ghostHue(g.genes)), scale: 0.8 });
        break;
      }
    }
  }

  private spawn(o: { id: string; kind: EntityKind; label: string; home: Platform; archetype?: ArchetypeId; ghost?: Ghost; obj?: THREE.Group; scale?: number; still?: boolean }): Entity {
    const obj = o.obj ?? makeEnemy(o.archetype!);
    if (o.scale) obj.scale.setScalar(o.scale);
    const pos = randIn(o.home);
    const e: Entity = { id: o.id, kind: o.kind, label: o.label, obj, pos, home: o.home, archetype: o.archetype, ghost: o.ghost };
    if (!o.still) e.wander = { target: randIn(o.home), wait: Math.random() * 2, speed: 0.9 + Math.random() * 0.6 };
    this.root.add(obj);
    this.entities.push(e);
    return e;
  }

  // A wild creature that was beaten or tamed leaves; another one turns up later.
  removeEntity(id: string, respawnMs = 15000) {
    const e = this.entities.find((x) => x.id === id);
    if (!e) return;
    this.root.remove(e.obj);
    this.entities = this.entities.filter((x) => x !== e);
    if (e.kind === "wild" && respawnMs > 0) {
      setTimeout(() => {
        const a = WILD_POOL[Math.floor(Math.random() * WILD_POOL.length)]!;
        this.spawn({ id: `${e.home.id}-${Date.now()}`, kind: "wild", label: `Wild ${a}`, archetype: a, home: e.home, scale: 0.8 });
      }, respawnMs);
    }
  }

  addTamed(a: ArchetypeId, n: number) {
    const home = this.map.platforms.find((p) => p.kind === "home")!;
    this.spawn({ id: `tamed-${n}`, kind: "tamed", label: `Your ${a}`, archetype: a, home, scale: 0.6 });
  }

  setHomeDecor(slots: readonly Slot[]) {
    this.homeDecor.clear();
    const home = this.map?.platforms.find((p) => p.kind === "home");
    if (!home) return;
    for (let i = 0; i < HOME_SLOTS; i++) {
      const kind = slots[i];
      if (!kind) continue;
      const s = slotPosition(i, home.r - 0.8);
      const d = makeDecor(kind);
      d.position.set(home.x + s.x, 0, home.z + s.z);
      d.rotation.y = ((90 - s.deg) * Math.PI) / 180;
      this.homeDecor.add(d);
    }
  }

  // Screen position (canvas px) above the pet or the creature the player is next to, for speech bubbles.
  anchor(who: "pet" | "enemy"): { x: number; y: number } | null {
    const obj = who === "pet" ? this.pet : this.near?.obj;
    if (!obj) return null;
    const v = obj.position.clone().add(new THREE.Vector3(0, 1.8, 0)).project(this.camera);
    return { x: ((v.x + 1) / 2) * this.canvas.clientWidth, y: ((1 - v.y) / 2) * this.canvas.clientHeight };
  }

  get nearEntity(): Entity | null {
    return this.near;
  }

  resize(aspect: number) {
    this.aspect = aspect;
    const half = aspect < 1 ? 7.5 / aspect : 7.5;
    this.camera.left = -half * aspect;
    this.camera.right = half * aspect;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number, t: number) {
    dt = Math.min(dt, 0.1);
    const ok = (x: number, z: number) => walkable(this.map, x, z);
    if (!this.paused) {
      const dir = keyDir(this.keys);
      let dx = dir.x * WALK_SPEED * dt;
      let dz = dir.z * WALK_SPEED * dt;
      if (dx || dz) {
        this.target = null;
        this.targetEntity = null;
      } else if (this.target) {
        const s = stepToward(this.player, this.target, WALK_SPEED * dt);
        dx = s.dx;
        dz = s.dz;
        if (s.arrived) {
          this.target = null;
          if (this.targetEntity && this.near === this.targetEntity) this.onInteract(this.targetEntity);
          this.targetEntity = null;
        }
      }
      const before = this.player;
      this.player = slide(this.player, dx, dz, ok);
      if (this.player === before && this.target) this.target = null; // blocked: give up the click target
      if (dx || dz) this.avatar.rotation.y = Math.atan2(dx, dz);
      this.petPos = followStep(this.petPos, this.player, dt, ok);
    }
    const moving = this.keys.size > 0 || this.target !== null;
    this.avatar.position.set(this.player.x, moving ? Math.abs(Math.sin(t / 110)) * 0.08 : 0, this.player.z);
    const pdx = this.player.x - this.pet.position.x;
    const pdz = this.player.z - this.pet.position.z;
    this.pet.position.set(this.petPos.x, 0, this.petPos.z);
    if (Math.hypot(pdx, pdz) > 0.3) this.pet.rotation.y = Math.atan2(pdx, pdz);
    this.pet.children[0]!.scale.y = 0.85 + Math.sin(t / 400) * 0.03;

    for (const e of this.entities) {
      const w = e.wander;
      if (w && !this.paused) {
        if (w.wait > 0) w.wait -= dt;
        else {
          const s = stepToward(e.pos, w.target, w.speed * dt);
          e.pos = { x: e.pos.x + s.dx, z: e.pos.z + s.dz };
          if (s.dx || s.dz) e.obj.rotation.y = Math.atan2(s.dx, s.dz);
          if (s.arrived) {
            w.target = randIn(e.home);
            w.wait = 1 + Math.random() * 3;
          }
        }
      } else if (!w) {
        // Still creatures turn to face the player when close.
        const fx = this.player.x - e.pos.x;
        const fz = this.player.z - e.pos.z;
        if (Math.hypot(fx, fz) < 5) e.obj.rotation.y = Math.atan2(fx, fz);
      }
      e.obj.position.set(e.pos.x, 0, e.pos.z);
    }

    // Closest creature within reach is the one the player can interact with.
    let best: Entity | null = null;
    let bestD = 2.2;
    for (const e of this.entities) {
      if (e.kind === "tamed") continue;
      const d = Math.hypot(e.pos.x - this.player.x, e.pos.z - this.player.z);
      if (d < bestD) {
        best = e;
        bestD = d;
      }
    }
    if (best !== this.near) {
      this.near = best;
      this.onNear(best);
    }

    this.camera.position.set(this.player.x, 14, this.player.z + 13);
    this.camera.lookAt(this.player.x, 0, this.player.z);
  }

  private key(e: KeyboardEvent, down: boolean) {
    const el = document.activeElement;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
    const k = e.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
      if (down) this.keys.add(k);
      else this.keys.delete(k);
      e.preventDefault();
    } else if (down && (k === "e" || k === " ") && this.near && !this.paused) {
      e.preventDefault();
      this.onInteract(this.near);
    }
  }

  private click(e: PointerEvent) {
    if (this.paused || !this.map) return;
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.ground, hit)) return;
    const ent = this.entities.find((x) => x.kind !== "tamed" && Math.hypot(x.pos.x - hit.x, x.pos.z - hit.z) < 1.1) ?? null;
    if (ent && this.near === ent) {
      this.onInteract(ent);
      return;
    }
    this.targetEntity = ent;
    this.target = ent ? { x: ent.pos.x + (this.player.x > ent.pos.x ? 1.2 : -1.2), z: ent.pos.z } : walkable(this.map, hit.x, hit.z) ? { x: hit.x, z: hit.z } : null;
  }
}
