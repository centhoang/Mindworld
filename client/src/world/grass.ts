import * as THREE from "three";

export interface Circle { x: number; z: number; r: number }
export interface GrassOptions {
  seed?: number;
  bladesPerUnit2?: number;
  maxBlades?: number;
  flowerRatio?: number;
  base?: number;
  tip?: number;
  flowerColors?: number[];
  height?: number;
}
export interface Scatter { x: number; z: number; rot: number; scale: number; tint: number }

const MARGIN = 0.6;
const TAU = Math.PI * 2;
const FLOWER_COLORS = [0xffffff, 0xfff1a8, 0xffc4d6, 0xc9b8ff];

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

function validCircle(c: Circle): boolean {
  return Number.isFinite(c.x) && Number.isFinite(c.z) && Number.isFinite(c.r) && c.r >= 0;
}

function nonnegative(n: number | undefined, fallback: number): number {
  return n !== undefined && Number.isFinite(n) ? Math.max(0, n) : fallback;
}

/** Area-weighted disc sampling avoids wasting attempts in gaps between islands.
 * Overlaps are accepted with probability 1 / coverage, keeping the union uniform.
 * Completely obstructed meadows return fewer points after a fixed attempt budget.
 */
export function scatter(areas: Circle[], holes: Circle[], count: number, seed: number): Scatter[] {
  if (!Number.isFinite(count) || count < 1) return [];
  const target = Math.floor(count);
  const discs = areas.filter((c) => validCircle(c) && c.r > MARGIN);
  const exclusions = holes.filter(validCircle);
  const cumulative: number[] = [];
  let total = 0;
  for (const c of discs) {
    total += (c.r - MARGIN) ** 2;
    cumulative.push(total);
  }
  if (total === 0 || !Number.isFinite(total)) return [];
  const random = mulberry32(seed);
  const points: Scatter[] = [];
  const attempts = target * 32;
  for (let attempt = 0; attempt < attempts && points.length < target; attempt++) {
    const choice = random() * total;
    let lo = 0;
    let hi = discs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (choice < cumulative[mid]!) hi = mid;
      else lo = mid + 1;
    }
    const disc = discs[lo]!;
    const radius = Math.sqrt(random()) * (disc.r - MARGIN);
    const angle = random() * TAU;
    const x = disc.x + Math.cos(angle) * radius;
    const z = disc.z + Math.sin(angle) * radius;
    if (exclusions.some((h) => (x - h.x) ** 2 + (z - h.z) ** 2 <= h.r ** 2)) continue;
    let coverage = 0;
    for (const c of discs) {
      if ((x - c.x) ** 2 + (z - c.z) ** 2 <= (c.r - MARGIN) ** 2) coverage++;
    }
    if (coverage > 1 && random() * coverage >= 1) continue;
    points.push({ x, z, rot: random() * TAU, scale: 0.75 + random() * 0.55, tint: 0.84 + random() * 0.3 });
  }
  return points;
}

function geometry(positions: number[], indices: number[], bloom: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("meadowBloom", new THREE.Float32BufferAttribute(bloom, 1));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function bladeGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  // Four curved segments, with one shared tip (seven triangles per blade).
  const widths = [0.055, 0.046, 0.032, 0.017];
  for (let row = 0; row < 4; row++) {
    const y = row / 4;
    positions.push(-widths[row]!, y, y * y * 0.14, widths[row]!, y, y * y * 0.14);
    if (row < 3) {
      const i = row * 2;
      indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
    }
  }
  positions.push(0, 1, 0.14);
  indices.push(6, 7, 8);
  return geometry(positions, indices, new Array<number>(9).fill(0));
}

function flowerGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const bloom: number[] = [];
  // Two opaque crossed stem strips and five cupped diamond petals, no textures.
  for (let axis = 0; axis < 2; axis++) {
    const i = positions.length / 3;
    const x = axis === 0 ? 0.012 : 0;
    const z = axis === 1 ? 0.012 : 0;
    positions.push(-x, 0, -z, x, 0, z, -x, 0.84, -z, x, 0.84, z);
    indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
    bloom.push(0, 0, 0, 0);
  }
  for (let petal = 0; petal < 5; petal++) {
    const a = petal * TAU / 5;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const i = positions.length / 3;
    positions.push(
      0, 0.82, 0,
      dx * 0.1 - dz * 0.065, 0.87, dz * 0.1 + dx * 0.065,
      dx * 0.22, 0.95, dz * 0.22,
      dx * 0.1 + dz * 0.065, 0.87, dz * 0.1 - dx * 0.065,
    );
    indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
    bloom.push(1, 1, 1, 1);
  }
  return geometry(positions, indices, bloom);
}

const VERTEX_COMMON = /* glsl */ `
uniform float meadowTime;
uniform vec4 meadowPush[4]; // x, z, radius, strength (world units)
uniform vec3 meadowBase;
uniform vec3 meadowTip;
uniform float meadowFlowers;
attribute float meadowBloom;
varying vec3 vMeadowColor;
`;

const VERTEX_PROJECT = /* glsl */ `
vec3 meadowGradient = mix(meadowBase, meadowTip, smoothstep(0.0, 1.0, position.y));
vMeadowColor = meadowGradient;
#ifdef USE_INSTANCING_COLOR
  vMeadowColor *= mix(instanceColor, vec3(1.0), meadowFlowers);
  vMeadowColor = mix(vMeadowColor, instanceColor, meadowBloom);
#endif
vec4 meadowRoot = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
vec4 meadowWorld = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
float meadowWave1 = sin(dot(meadowRoot.xz, vec2(0.48, 0.31)) + meadowTime * 1.25);
float meadowWave2 = sin(dot(meadowRoot.xz, vec2(-0.8, 0.55)) - meadowTime * 1.9);
vec2 meadowBend = vec2(0.11, 0.06) * meadowWave1 + vec2(0.04, -0.055) * meadowWave2;
for (int i = 0; i < 4; i++) {
  if (meadowPush[i].z > 0.0) {
    vec2 away = meadowRoot.xz - meadowPush[i].xy;
    float distanceToPush = length(away);
    vec2 direction = distanceToPush > 0.0001 ? away / distanceToPush : vec2(1.0, 0.0);
    float influence = 1.0 - smoothstep(0.0, meadowPush[i].z, distanceToPush);
    meadowBend += direction * influence * meadowPush[i].w;
  }
}
float meadowWeight = position.y * position.y;
meadowWorld.xz += meadowBend * meadowWeight;
meadowWorld.y -= min(0.2, dot(meadowBend, meadowBend) * 0.2) * meadowWeight;
vec4 mvPosition = viewMatrix * meadowWorld;
gl_Position = projectionMatrix * mvPosition;
`;

export class Grass {
  readonly group = new THREE.Group();
  private readonly time = { value: 0 };
  private readonly pushes = { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] };
  private readonly blades: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;
  private readonly flowers: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;
  private disposed = false;

  constructor(areas: Circle[], holes: Circle[], opts: GrassOptions = {}) {
    const seed = opts.seed ?? 1;
    const area = areas.reduce((sum, c) => sum + (validCircle(c) ? Math.PI * c.r * c.r : 0), 0);
    const count = Math.floor(Math.min(nonnegative(opts.maxBlades, 45000), area * nonnegative(opts.bladesPerUnit2, 9)));
    const points = scatter(areas, holes, count, seed);
    const flowerPoints = scatter(areas, holes, Math.floor(points.length * nonnegative(opts.flowerRatio, 0.04)), seed ^ 0x5bf03635);
    const base = { value: new THREE.Color(opts.base ?? 0x6fae3a) };
    const tip = { value: new THREE.Color(opts.tip ?? 0xd8e86a) };
    const makeMaterial = (flowers: boolean): THREE.MeshLambertMaterial => {
      const material = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, fog: true });
      material.onBeforeCompile = (shader) => {
        shader.uniforms.meadowTime = this.time;
        shader.uniforms.meadowPush = this.pushes;
        shader.uniforms.meadowBase = base;
        shader.uniforms.meadowTip = tip;
        shader.uniforms.meadowFlowers = { value: flowers ? 1 : 0 };
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", `#include <common>\n${VERTEX_COMMON}`)
          .replace("#include <project_vertex>", VERTEX_PROJECT)
          // Shadow receivers and fog must use the same displaced position as projection.
          .replace("#include <worldpos_vertex>", "vec4 worldPosition = meadowWorld;");
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", "#include <common>\nvarying vec3 vMeadowColor;")
          .replace("#include <color_fragment>", "diffuseColor.rgb *= vMeadowColor;");
      };
      material.customProgramCacheKey = () => "meadow-lambert-v1";
      return material;
    };
    const height = Math.max(0.01, nonnegative(opts.height, 0.55));
    const colors = opts.flowerColors?.length ? opts.flowerColors : FLOWER_COLORS;
    this.blades = this.makeMesh(bladeGeometry(), makeMaterial(false), points, height);
    this.flowers = this.makeMesh(flowerGeometry(), makeMaterial(true), flowerPoints, height * 1.1, colors);
    this.blades.name = "meadow-grass";
    this.flowers.name = "meadow-flowers";
    this.group.add(this.blades, this.flowers);
  }

  private makeMesh(g: THREE.BufferGeometry, material: THREE.MeshLambertMaterial, points: Scatter[], height: number, palette?: number[]): THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshLambertMaterial> {
    const mesh = new THREE.InstancedMesh(g, material, points.length);
    const transform = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      transform.position.set(p.x, 0, p.z);
      transform.rotation.y = p.rot;
      transform.scale.set(p.scale, p.scale * height, p.scale);
      transform.updateMatrix();
      mesh.setMatrixAt(i, transform.matrix);
      if (palette) color.setHex(palette[Math.min(palette.length - 1, Math.floor((p.rot / TAU) * palette.length))]!);
      else color.setRGB(1, 1, 1);
      color.multiplyScalar(p.tint);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.visible = points.length > 0;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    // Conservative padding for four simultaneous pushes plus both wind waves.
    mesh.boundingBox!.expandByScalar(3.2);
    mesh.boundingSphere!.radius += 3.2;
    return mesh;
  }

  update(t: number, push?: { x: number; z: number }[]): void {
    this.time.value = t;
    for (let i = 0; i < 4; i++) {
      const p = push?.[i];
      const uniform = this.pushes.value[i]!;
      if (p && Number.isFinite(p.x) && Number.isFinite(p.z)) uniform.set(p.x, p.z, 1.2, 0.68);
      else uniform.set(0, 0, 0, 0);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const mesh of [this.blades, this.flowers]) {
      mesh.removeFromParent();
      mesh.dispose();
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.group.removeFromParent();
  }
}
