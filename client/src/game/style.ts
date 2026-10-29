import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// The cozy look shared by the world and the battle view: pastel palette, toon materials, a gradient sky,
// soft lights with one cheap shadow map, clouds and floating islets below, and drifting fireflies/petals.
// All procedural (no asset files); see docs/VISUALS.md for the reasoning.

export const PAL = {
  skyTop: 0x9fd8f5,
  skyMid: 0xd7ecf7,
  skyLow: 0xffe1d0,
  fog: 0xe6eef6,
  grass: 0x8fd17a,
  grassDark: 0x6fb85e,
  soil: 0xd2a679,
  rock: 0xa9908a,
  rockDark: 0x8c7472,
  wood: 0xc98f5e,
  woodDark: 0xae7448,
  rope: 0xf3e2c0,
  cream: 0xfff3dc,
  cloud: 0xffffff,
  firefly: 0xffd75e,
  petal: 0xff9fbf,
};

let gradient: THREE.DataTexture | null = null;
function toonRamp(): THREE.DataTexture {
  if (gradient) return gradient;
  gradient = new THREE.DataTexture(new Uint8Array([150, 205, 255]), 3, 1, THREE.RedFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

// One material per call: callers (ghost pets, the boss) tweak their copies.
export const toon = (color: number, extra: THREE.MeshToonMaterialParameters = {}) =>
  new THREE.MeshToonMaterial({ color, gradientMap: toonRamp(), ...extra });

// Screen-space vertical gradient used as the scene background.
export function skyTexture(top = PAL.skyTop, mid = PAL.skyMid, low = PAL.skyLow): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
  g.addColorStop(0, hex(top));
  g.addColorStop(0.55, hex(mid));
  g.addColorStop(1, hex(low));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function setupRenderer(r: THREE.WebGLRenderer) {
  r.setPixelRatio(Math.min(1.5, window.devicePixelRatio)); // iGPU-friendly
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
}

// Warm sun with a small shadow map (the caller moves it with the camera) plus a sky/ground fill.
export function addLights(scene: THREE.Scene, span: number): THREE.DirectionalLight {
  scene.add(new THREE.HemisphereLight(0xfff6e8, 0xc9b6e4, 1.15));
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const c = sun.shadow.camera;
  c.left = c.bottom = -span;
  c.right = c.top = span;
  c.near = 1;
  c.far = 60;
  sun.shadow.bias = -0.0015;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  return sun;
}

// Frees GPU buffers of a removed subtree (textures such as the shared toon ramp are kept).
export function disposeTree(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh && !(o as THREE.Sprite).isSprite) return;
    m.geometry?.dispose();
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat?.dispose();
  });
}

export function castAll(obj: THREE.Object3D, receive = true) {
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = receive;
    }
  });
}

// A floating island: grass cap with a soft lip, a soil band, and a rocky cone hanging below.
export function makeIsland(r: number, top = PAL.grass): THREE.Group {
  const g = new THREE.Group();
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.99, 0.32, 40), toon(top));
  grass.position.y = -0.16;
  grass.receiveShadow = true;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(r * 0.985, 0.13, 6, 40), toon(new THREE.Color(top).multiplyScalar(0.88).getHex()));
  lip.rotation.x = Math.PI / 2;
  lip.position.y = -0.22;
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.97, r * 0.82, 0.55, 28), toon(PAL.soil));
  soil.position.y = -0.6;
  const rock = new THREE.Mesh(new THREE.ConeGeometry(r * 0.82, r * 1.05, 9, 2), toon(PAL.rock));
  rock.rotation.x = Math.PI;
  rock.position.y = -0.87 - r * 0.525;
  g.add(grass, lip, soil, rock);
  // A few smaller rocks clinging to the underside.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + r;
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(r * 0.16, 0), toon(i % 2 ? PAL.rockDark : PAL.rock));
    b.position.set(Math.cos(a) * r * 0.55, -1.2 - (i % 2) * 0.5, Math.sin(a) * r * 0.55);
    g.add(b);
  }
  return g;
}

// Soft round sprite for particles and cloud puffs.
let dot: THREE.CanvasTexture | null = null;
export function softDot(): THREE.CanvasTexture {
  if (dot) return dot;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.8)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  dot = new THREE.CanvasTexture(c);
  return dot;
}

// Puffy clouds drifting below the islands: one instanced mesh, a handful of puffs per cloud.
export class Clouds {
  readonly mesh: THREE.InstancedMesh;
  private readonly puffs: { cx: number; cz: number; y: number; dx: number; dy: number; dz: number; s: number; speed: number }[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly sc = new THREE.Vector3();

  constructor(private readonly minX: number, private readonly maxX: number, minZ: number, maxZ: number, count: number, yMin: number, yMax: number) {
    const per = 5;
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), toon(PAL.cloud, { transparent: true, opacity: 0.85 }), count * per);
    for (let c = 0; c < count; c++) {
      const cx = minX + Math.random() * (maxX - minX);
      const cz = minZ + Math.random() * (maxZ - minZ);
      const y = yMin + Math.random() * (yMax - yMin);
      const size = 1 + Math.random() * 1.2;
      const speed = 0.25 + Math.random() * 0.35;
      for (let i = 0; i < per; i++) {
        this.puffs.push({ cx, cz, y, dx: (i - 2) * 0.9 * size, dy: (i % 2) * 0.35 * size, dz: (Math.random() - 0.5) * 1.2 * size, s: size * (1 - Math.abs(i - 2) * 0.18), speed });
      }
    }
    this.update(0);
  }

  update(dt: number) {
    const w = this.maxX - this.minX;
    this.puffs.forEach((p, i) => {
      p.cx += p.speed * dt;
      if (p.cx > this.maxX) p.cx -= w;
      this.v.set(p.cx + p.dx, p.y + p.dy, p.cz + p.dz);
      this.sc.set(p.s * 1.25, p.s * 0.8, p.s);
      this.m.compose(this.v, this.q, this.sc);
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// Fireflies and petals drifting in a box that follows a centre point (the player in the world).
export class Motes {
  readonly points: THREE.Points;
  private readonly base: Float32Array;
  private readonly phase: Float32Array;

  constructor(count: number, private readonly half: number, private readonly height: number) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    this.base = new Float32Array(count * 3);
    this.phase = new Float32Array(count);
    const a = new THREE.Color(PAL.firefly);
    const b = new THREE.Color(PAL.petal);
    for (let i = 0; i < count; i++) {
      this.base[i * 3] = (Math.random() * 2 - 1) * half;
      this.base[i * 3 + 1] = Math.random() * height;
      this.base[i * 3 + 2] = (Math.random() * 2 - 1) * half;
      this.phase[i] = Math.random() * 100;
      const c = i % 3 ? a : b;
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 7, sizeAttenuation: false, map: softDot(), vertexColors: true, transparent: true, depthWrite: false, opacity: 0.95 }),
    );
    this.points.frustumCulled = false;
  }

  update(t: number, cx: number, cz: number) {
    const s = t / 1000;
    const pos = this.points.geometry.getAttribute("position") as THREE.BufferAttribute;
    const h = this.half;
    const wrap = (v: number) => ((((v + h) % (2 * h)) + 2 * h) % (2 * h)) - h;
    for (let i = 0; i < this.phase.length; i++) {
      const p = this.phase[i]!;
      const x = this.base[i * 3]! + Math.sin(s * 0.4 + p) * 0.8;
      const y = (this.base[i * 3 + 1]! + s * 0.15 + p) % this.height;
      const z = this.base[i * 3 + 2]! + Math.cos(s * 0.3 + p) * 0.8;
      pos.setXYZ(i, cx + wrap(x - cx), y + Math.sin(s * 2 + p) * 0.1, cz + wrap(z - cz));
    }
    pos.needsUpdate = true;
  }
}

// Pill-shaped name tag drawn on a canvas.
export function labelSprite(text: string, scale = 1): THREE.Sprite {
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  const font = "700 40px 'Nunito', 'Trebuchet MS', system-ui, sans-serif";
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 56;
  c.width = w;
  c.height = 72;
  ctx.font = font;
  ctx.fillStyle = "rgba(255,248,236,0.92)";
  ctx.strokeStyle = "rgba(201,143,94,0.9)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(3, 3, w - 6, 66, 33);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#6b4a3a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, 38);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  s.renderOrder = 10;
  s.scale.set((w / 72) * 0.62 * scale, 0.62 * scale, 1);
  return s;
}

// Bakes many small static meshes into one mesh per material look, so the world costs tens of draw
// calls instead of hundreds (planks, posts, flowers...). The originals are removed from their parents.
export function mergeStatic(parent: THREE.Object3D, objs: THREE.Object3D[]): THREE.Mesh[] {
  parent.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
  const byKey = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[] }>();
  for (const obj of objs) {
    obj.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || Array.isArray(o.material) || o instanceof THREE.InstancedMesh) return;
      const m = o.material as THREE.MeshToonMaterial;
      if (m.transparent) return;
      const key = `${m.type}:${m.color?.getHex()}:${m.emissive?.getHex() ?? 0}`;
      let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const name of Object.keys(geo.attributes)) if (!["position", "normal", "uv"].includes(name)) geo.deleteAttribute(name);
      geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      const e = byKey.get(key) ?? { mat: m, geos: [] };
      e.geos.push(geo);
      byKey.set(key, e);
    });
    obj.removeFromParent();
  }
  const out: THREE.Mesh[] = [];
  for (const { mat, geos } of byKey.values()) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    out.push(mesh);
  }
  return out;
}
