import * as THREE from "three";
import { makeBossMesh, makeDecor, makeEnemy, makeGhostPet, makePet } from "../game/scene";
import { HOME_SLOTS, slotPosition, type Slot } from "../game/home";
import { addLights, castAll, Clouds, labelSprite, makeIsland, mergeStatic, Motes, PAL, skyTexture, toon } from "../game/style";
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

const mat = (color: number) => toon(color);

const TOP: Record<Platform["kind"], number> = {
  home: 0x8fd17a, wild: 0xa8dc84, boss: 0xbba6dc, market: 0xf2d79a, npc: 0x9fd89a, event: 0xbcc9f0, corner: 0x96d6a0,
};
const WILD_POOL: ArchetypeId[] = ["brute", "skitter", "turtle", "pal", "bully"];

function island(p: Platform): THREE.Group {
  const g = makeIsland(p.r, TOP[p.kind]);
  g.position.set(p.x, 0, p.z);
  return g;
}

function bridgeMesh(ax: number, az: number, bx: number, bz: number, w: number): THREE.Group {
  const g = new THREE.Group();
  const len = Math.hypot(bx - ax, bz - az);
  const planks = Math.max(2, Math.round(len / 0.5));
  for (let i = 0; i < planks; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(w * (0.94 + (i % 3) * 0.03), 0.14, 0.4), mat(i % 2 ? PAL.wood : PAL.woodDark));
    plank.position.set(0, -0.08, -len / 2 + (i + 0.5) * (len / planks));
    plank.rotation.y = ((i * 37) % 7 - 3) * 0.012;
    g.add(plank);
  }
  // Posts with a sagging rope between them on each side.
  const posts = Math.max(2, Math.round(len / 2.5) + 1);
  for (const s of [-1, 1]) {
    for (let i = 0; i < posts; i++) {
      const z = -len / 2 + (i * len) / (posts - 1);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.7, 8), mat(PAL.woodDark));
      post.position.set((s * w) / 2, 0.25, z);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mat(PAL.wood));
      knob.position.set((s * w) / 2, 0.62, z);
      g.add(post, knob);
    }
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 40; k++) {
      const z = -len / 2 + (k / 40) * len;
      const seg = (k / 40) * (posts - 1);
      const f = seg - Math.floor(seg);
      pts.push(new THREE.Vector3((s * w) / 2, 0.55 - Math.sin(f * Math.PI) * 0.15, z));
    }
    const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.035, 5), mat(PAL.rope));
    g.add(rope);
  }
  g.position.set((ax + bx) / 2, 0, (az + bz) / 2);
  g.rotation.y = Math.atan2(bx - ax, bz - az);
  return g;
}

export function makeAvatar(robe = 0x7fa8f0, hat = 0xf28b82): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.3, 4, 14), mat(robe));
  body.position.y = 0.5;
  body.scale.set(1, 1, 0.9);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 16), mat(0xffdcbc));
  head.position.y = 1.22;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.1), mat(0x8a5a44));
  hair.position.y = 1.26;
  hair.rotation.x = -0.25;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.42, 14), mat(hat));
  cap.position.set(0, 1.72, -0.04);
  cap.rotation.x = -0.2;
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), mat(PAL.cream));
  pom.position.set(0, 1.94, -0.08);
  g.add(body, head, hair, cap, pom);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat(0x3a2a2a));
    eye.position.set(s * 0.13, 1.2, 0.34);
    eye.scale.set(1, 1.3, 0.6);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    shine.position.set(0.015, 0.02, 0.04);
    eye.add(shine);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(0xffa5b5));
    cheek.position.set(s * 0.22, 1.1, 0.29);
    cheek.scale.set(1.3, 0.7, 0.4);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat(0x8a5a44));
    foot.position.set(s * 0.15, 0.08, 0.05);
    foot.scale.set(1, 0.7, 1.3);
    g.add(eye, cheek, foot);
  }
  return g;
}

function house(roof = 0xe8857a): THREE.Group {
  const g = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 1.5), mat(PAL.cream));
  walls.position.y = 0.6;
  const top = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.95, 4), mat(roof));
  top.position.y = 1.67;
  top.rotation.y = Math.PI / 4;
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.22), mat(0xc77b6b));
  chimney.position.set(0.45, 1.9, -0.25);
  const door = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.3, 4, 10), mat(0x9a6a48));
  door.position.set(0, 0.36, 0.75);
  door.scale.z = 0.2;
  g.add(walls, top, chimney, door);
  for (const s of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.05), toon(0xffe9a8, { emissive: 0xffc25e, emissiveIntensity: 0.6 }));
    win.position.set(s * 0.55, 0.72, 0.76);
    g.add(win);
  }
  const step = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.38, 0.08, 16), mat(0xd8c3a5));
  step.position.set(0, 0.04, 0.95);
  g.add(step);
  return g;
}

function stall(): THREE.Group {
  const g = new THREE.Group();
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 0.8), mat(PAL.wood));
  table.position.y = 0.35;
  g.add(table);
  for (let i = 0; i < 5; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 1.1), mat(i % 2 ? PAL.cream : 0xf28b82));
    stripe.position.set(-0.8 + i * 0.4, 1.7, 0);
    g.add(stripe);
  }
  for (const s of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.7), mat(PAL.woodDark));
    pole.position.set(s * 0.9, 0.85, 0.4);
    g.add(pole);
  }
  for (const [x, c] of [[-0.5, 0xffb347], [0, 0xa8dc84], [0.5, 0xff9fb2]] as const) {
    const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), mat(c));
    fruit.position.set(x, 0.85, 0.1);
    g.add(fruit);
  }
  return g;
}

// Small floating islets in the gaps between platforms, bobbing gently.
function islet(r: number): THREE.Group {
  const g = makeIsland(r, PAL.grassDark);
  const tuft = makeDecor(Math.random() < 0.5 ? "tree" : "flower");
  tuft.scale.setScalar(r * 0.9);
  g.add(tuft);
  mergeStatic(g, [...g.children]);
  return g;
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
  private readonly sun: THREE.DirectionalLight;
  private clouds: Clouds | null = null;
  private readonly motes = new Motes(45, 11, 3.5);
  private readonly islets: THREE.Group[] = [];

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.scene.background = skyTexture();
    this.scene.fog = new THREE.Fog(PAL.fog, 24, 48);
    this.sun = addLights(this.scene, 14);
    this.scene.add(this.root, this.avatar, this.pet, this.motes.points);
    this.pet.scale.setScalar(0.75);
    castAll(this.avatar);
    castAll(this.pet);
    window.addEventListener("keydown", (e) => this.key(e, true));
    window.addEventListener("keyup", (e) => this.key(e, false));
    window.addEventListener("blur", () => this.keys.clear());
    canvas.addEventListener("pointerdown", (e) => this.click(e));
  }

  build(map: WorldMap, content: WorldContent) {
    this.map = map;
    this.root.clear();
    this.entities = [];
    this.islets.length = 0;
    for (const b of map.bridges) this.root.add(bridgeMesh(b.ax, b.az, b.bx, b.bz, b.w));
    for (const p of map.platforms) {
      this.root.add(island(p));
      const tag = labelSprite(p.label);
      tag.position.set(p.x, 1.7, p.z - p.r * 0.45);
      this.root.add(tag);
      this.furnish(p, content);
      if (p.kind !== "event" && p.kind !== "boss") {
        for (let i = 0; i < 5; i++) {
          const v = randIn(p, 0.6);
          const tuft = makeDecor("flower");
          tuft.position.set(v.x, 0, v.z);
          tuft.rotation.y = Math.random() * Math.PI * 2;
          tuft.scale.setScalar(0.45);
          this.root.add(tuft);
        }
      }
    }
    // Clouds and islets fill the sky around and below the grid of platforms.
    const xs = map.platforms.map((p) => p.x);
    const zs = map.platforms.map((p) => p.z);
    const [x0, x1, z0, z1] = [Math.min(...xs) - 12, Math.max(...xs) + 12, Math.min(...zs) - 12, Math.max(...zs) + 12];
    this.clouds = new Clouds(x0, x1, z0, z1, 20, -13, -7);
    this.root.add(this.clouds.mesh);
    const far = (x: number, z: number) => map.platforms.every((p) => Math.hypot(p.x - x, p.z - z) > p.r + 3);
    for (let i = 0; i < 40 && this.islets.length < 10; i++) {
      const x = x0 + 6 + Math.random() * (x1 - x0 - 12);
      const z = z0 + 6 + Math.random() * (z1 - z0 - 12);
      const offAxis = map.bridges.every((b) => Math.abs(b.ax - b.bx) < 0.1 ? Math.abs(x - b.ax) > 4.5 || z < Math.min(b.az, b.bz) || z > Math.max(b.az, b.bz) : Math.abs(z - b.az) > 4.5 || x < Math.min(b.ax, b.bx) || x > Math.max(b.ax, b.bx));
      if (!far(x, z) || !offAxis || this.islets.some((o) => Math.hypot(o.position.x - x, o.position.z - z) < 4)) continue;
      const o = islet(0.6 + Math.random() * 0.7);
      o.position.set(x, -1.5 - Math.random() * 2, z);
      o.userData.y = o.position.y;
      o.userData.phase = Math.random() * 10;
      this.islets.push(o);
      this.root.add(o);
    }
    this.setHomeDecor(content.home);
    castAll(this.root);
    if (this.clouds) this.clouds.mesh.castShadow = this.clouds.mesh.receiveShadow = false;
    // Everything that never moves gets merged; creatures, islets, clouds, labels and home decor stay live.
    const live = new Set<THREE.Object3D>([...this.entities.map((e) => e.obj), ...this.islets, this.homeDecor]);
    if (this.clouds) live.add(this.clouds.mesh);
    mergeStatic(this.root, this.root.children.filter((c) => !live.has(c) && !(c instanceof THREE.Sprite)));
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
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.1, 8, 48), mat(0xffe08a));
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
    obj.userData.base = obj.scale.x;
    obj.userData.phase = Math.random() * 10;
    castAll(obj);
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
      castAll(d);
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
      // Idle life: a little hop while walking, slow breathing while standing.
      const ph = e.obj.userData.phase ?? 0;
      const base = e.obj.userData.base ?? 1;
      const walking = !!w && w.wait <= 0 && !this.paused;
      e.obj.position.set(e.pos.x, walking ? Math.abs(Math.sin(t / 130 + ph)) * 0.12 : 0, e.pos.z);
      e.obj.scale.set(base, base * (1 + Math.sin(t / 520 + ph) * 0.035), base);
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

    this.clouds?.update(dt);
    this.motes.update(t, this.player.x, this.player.z);
    for (const o of this.islets) o.position.y = o.userData.y + Math.sin(t / 1400 + o.userData.phase) * 0.25;
    this.sun.position.set(this.player.x + 8, 18, this.player.z + 10);
    this.sun.target.position.set(this.player.x, 0, this.player.z);
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
