import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { Grass, scatter } from "./grass";
import type { Circle } from "./grass";

const areas: Circle[] = [{ x: -3, z: 2, r: 4 }, { x: 4, z: -1, r: 3 }, { x: -1, z: 1, r: 3 }];
const holes: Circle[] = [{ x: -3, z: 2, r: 1.3 }, { x: 4.5, z: -1.5, r: 0.8 }];

describe("meadow scatter", () => {
  it("repeats a seed exactly without mutating the circles", () => {
    const before = structuredClone({ areas, holes });
    const first = scatter(areas, holes, 300, 1234);
    expect(first).toEqual(scatter(areas, holes, 300, 1234));
    expect(first).not.toEqual(scatter(areas, holes, 300, 4321));
    expect(scatter(areas, holes, 20, 0)).toEqual(scatter(areas, holes, 20, 0));
    expect({ areas, holes }).toEqual(before);
  });

  it("fills the requested count inside inset areas and outside every hole", () => {
    const points = scatter(areas, holes, 1000, 42);
    expect(points).toHaveLength(1000);
    for (const p of points) {
      expect(areas.some((a) => Math.hypot(p.x - a.x, p.z - a.z) <= a.r - 0.6 + 1e-10)).toBe(true);
      for (const h of holes) expect(Math.hypot(p.x - h.x, p.z - h.z)).toBeGreaterThan(h.r);
      expect(p.rot).toBeGreaterThanOrEqual(0);
      expect(p.rot).toBeLessThan(Math.PI * 2);
      expect(p.scale).toBeGreaterThanOrEqual(0.75);
      expect(p.scale).toBeLessThan(1.3);
      expect(p.tint).toBeGreaterThanOrEqual(0.84);
      expect(p.tint).toBeLessThan(1.14);
    }
  });

  it("handles empty, tiny, fully covered and nearly covered areas with bounded work", () => {
    expect(scatter([], [], 20, 1)).toEqual([]);
    expect(scatter([{ x: 0, z: 0, r: 0.6 }], [], 20, 1)).toEqual([]);
    expect(scatter([{ x: 0, z: 0, r: 0.601 }], [], 20, 1)).toHaveLength(20);
    const area = [{ x: 0, z: 0, r: 2 }];
    expect(scatter(area, [{ x: 0, z: 0, r: 2 }], 100, 1)).toEqual([]);
    const almostCovered = scatter(area, [{ x: 0, z: 0, r: 1.39999 }], 100, 1);
    expect(almostCovered.length).toBeLessThan(100);
    for (const p of almostCovered) expect(Math.hypot(p.x, p.z)).toBeGreaterThan(1.39999);
    for (const count of [0, -1, Infinity, NaN]) expect(scatter(areas, holes, count, 1)).toEqual([]);
    expect(scatter(areas, holes, 3.9, 1)).toHaveLength(3);
  });
});

type MeadowMesh = THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;

describe("Grass (no renderer)", () => {
  it("uses two meshes, the area density, the hard cap and the flower ratio", () => {
    const area = [{ x: 0, z: 0, r: 3 }];
    const grass = new Grass(area, [], { maxBlades: 100, flowerRatio: 0.1 });
    try {
      expect(grass.group.children).toHaveLength(2);
      const [blades, flowers] = grass.group.children as MeadowMesh[];
      expect(blades!.count).toBe(100);
      expect(flowers!.count).toBe(10);
      for (const mesh of [blades!, flowers!]) {
        expect(mesh.isInstancedMesh).toBe(true);
        expect(mesh.castShadow).toBe(false);
        expect(mesh.receiveShadow).toBe(true);
        expect(mesh.material.side).toBe(THREE.DoubleSide);
        expect(mesh.instanceColor?.count).toBe(mesh.count);
        expect(mesh.boundingSphere!.radius).toBeGreaterThan(3.2);
      }
      expect(blades!.geometry.index!.count).toBe(21);
    } finally { grass.dispose(); }
    const defaults = new Grass(area, []);
    expect((defaults.group.children[0] as MeadowMesh).count).toBe(Math.floor(Math.PI * 9 * 9));
    expect((defaults.group.children[1] as MeadowMesh).count).toBe(Math.floor(Math.floor(Math.PI * 9 * 9) * 0.04));
    defaults.dispose();
  });

  it("keeps shader uniform objects stable, limits pushes to four and clears stale pushes", () => {
    const grass = new Grass([{ x: 0, z: 0, r: 2 }], [], { maxBlades: 10, flowerRatio: 0.2 });
    try {
      const shaders = (grass.group.children as MeadowMesh[]).map((mesh) => {
        const shader = {
          uniforms: {}, vertexShader: THREE.ShaderLib.lambert.vertexShader,
          fragmentShader: THREE.ShaderLib.lambert.fragmentShader,
        } as Parameters<THREE.MeshLambertMaterial["onBeforeCompile"]>[0];
        // The hook only transforms shader source and uniforms; it never uses a renderer.
        mesh.material.onBeforeCompile(shader, undefined as unknown as THREE.WebGLRenderer);
        return shader;
      });
      const shader = shaders[0]!;
      const time = shader.uniforms.meadowTime!;
      const pushes = shader.uniforms.meadowPush!.value as THREE.Vector4[];
      const identities = [...pushes];
      const mesh = grass.group.children[0] as MeadowMesh;
      const matrixVersion = mesh.instanceMatrix.version;
      grass.update(5, [{ x: 1, z: 2 }, { x: 3, z: 4 }, { x: 5, z: 6 }, { x: 7, z: 8 }, { x: 9, z: 10 }]);
      expect(time.value).toBe(5);
      expect(pushes.map((p) => p.toArray())).toEqual([[1, 2, 1.2, 0.68], [3, 4, 1.2, 0.68], [5, 6, 1.2, 0.68], [7, 8, 1.2, 0.68]]);
      grass.update(6, [{ x: -1, z: -2 }]);
      expect(pushes[0]!.toArray()).toEqual([-1, -2, 1.2, 0.68]);
      for (let i = 0; i < 4; i++) expect(pushes[i]).toBe(identities[i]);
      for (let i = 1; i < 4; i++) expect(pushes[i]!.z).toBe(0);
      grass.update(7);
      expect(pushes.every((p) => p.z === 0)).toBe(true);
      expect(shader.uniforms.meadowTime).toBe(time);
      expect(shaders[1]!.uniforms.meadowTime).toBe(time);
      expect(shaders[1]!.uniforms.meadowPush!.value).toBe(pushes);
      expect(mesh.instanceMatrix.version).toBe(matrixVersion);
      expect(shader.vertexShader).toContain("vec4 worldPosition = meadowWorld;");
      expect(shader.vertexShader).toContain("#include <fog_vertex>");
      expect(shader.vertexShader).toContain("#include <shadowmap_vertex>");
      expect(shader.fragmentShader).toContain("#include <lights_lambert_fragment>");
      expect(shader.fragmentShader).toContain("#include <fog_fragment>");
    } finally { grass.dispose(); }
  });

  it("disposes geometry, materials and instancing resources once and detaches the group", () => {
    const grass = new Grass([], []);
    const scene = new THREE.Scene();
    scene.add(grass.group);
    const disposals: ReturnType<typeof vi.fn>[] = [];
    for (const mesh of grass.group.children as MeadowMesh[]) {
      expect(mesh.visible).toBe(false);
      const meshDisposed = vi.fn();
      const geometryDisposed = vi.fn();
      const materialDisposed = vi.fn();
      mesh.addEventListener("dispose", meshDisposed);
      mesh.geometry.addEventListener("dispose", geometryDisposed);
      mesh.material.addEventListener("dispose", materialDisposed);
      disposals.push(meshDisposed, geometryDisposed, materialDisposed);
    }
    grass.dispose();
    grass.dispose();
    expect(grass.group.children).toHaveLength(0);
    expect(grass.group.parent).toBe(null);
    for (const listener of disposals) expect(listener).toHaveBeenCalledTimes(1);
  });
});
