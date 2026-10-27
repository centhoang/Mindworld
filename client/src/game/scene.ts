import * as THREE from "three";
import type { Action, ArchetypeId, EnemyAct } from "../sim/types";

// The arena: a procedural pet (left) and enemy (right) on a low-poly plot, plus short tweened animations
// for each move. Everything is built from primitives so there are no asset files to load.

const mat = (color: number) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8 });

function eyes(parent: THREE.Object3D, y: number, z: number, spread: number, r: number, angry = false) {
  for (const s of [-1, 1]) {
    const white = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat(0xffffff));
    white.position.set(s * spread, y, z);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 10, 8), mat(0x111111));
    pupil.position.set(0, 0, r * 0.6);
    white.add(pupil);
    if (angry) {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(r * 2.2, r * 0.4, r * 0.4), mat(0x222222));
      brow.position.set(0, r * 1.1, r * 0.4);
      brow.rotation.z = s * -0.45;
      white.add(brow);
    }
    parent.add(white);
  }
}

export function makePet(color = 0xf4b183): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 2), mat(color));
  body.scale.set(1, 0.85, 0.95);
  body.position.y = 0.55;
  g.add(body);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.38, 6), mat(color));
    ear.position.set(s * 0.32, 1.05, 0);
    ear.rotation.z = s * -0.35;
    g.add(ear);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), mat(new THREE.Color(color).multiplyScalar(0.8).getHex()));
    foot.position.set(s * 0.28, 0.1, 0.15);
    g.add(foot);
  }
  eyes(g, 0.68, 0.48, 0.2, 0.11);
  const blush = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(0xff8fa3));
  blush.position.set(0, 0.5, 0.55);
  blush.scale.set(1.6, 0.6, 0.4);
  g.add(blush);
  return g;
}

export function makeEnemy(id: ArchetypeId): THREE.Group {
  const g = new THREE.Group();
  switch (id) {
    case "brute": {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.2, 1.0), mat(0xc0504d));
      body.position.y = 0.7;
      g.add(body);
      for (const s of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 6), mat(0xeeeecc));
        horn.position.set(s * 0.45, 1.45, 0);
        horn.rotation.z = s * -0.5;
        g.add(horn);
      }
      eyes(g, 0.95, 0.52, 0.28, 0.12, true);
      break;
    }
    case "skitter": {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), mat(0x8064a2));
      body.position.y = 0.45;
      g.add(body);
      for (let i = 0; i < 6; i++) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5), mat(0x4b3a66));
        const a = (i / 6) * Math.PI * 2;
        leg.position.set(Math.cos(a) * 0.35, 0.2, Math.sin(a) * 0.35);
        leg.rotation.set(Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8);
        g.add(leg);
      }
      eyes(g, 0.55, 0.28, 0.12, 0.08);
      break;
    }
    case "turtle": {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), mat(0x9bbb59));
      body.position.y = 0.35;
      g.add(body);
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x4f6228));
      shell.position.y = 0.3;
      shell.name = "shell";
      g.add(shell);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat(0x9bbb59));
      head.position.set(0, 0.45, 0.55);
      g.add(head);
      eyes(head, 0.06, 0.16, 0.09, 0.06);
      break;
    }
    case "pal": {
      const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 2), mat(0xffd966));
      body.position.y = 0.5;
      g.add(body);
      eyes(g, 0.6, 0.42, 0.17, 0.1);
      const smile = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 12, Math.PI), mat(0x7f6000));
      smile.position.set(0, 0.42, 0.47);
      smile.rotation.z = Math.PI;
      g.add(smile);
      break;
    }
    case "bully": {
      const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6), mat(0xf79646));
      body.position.y = 0.6;
      g.add(body);
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 5), mat(0x974706));
        spike.position.set((i - 2) * 0.2, 1.2 - Math.abs(i - 2) * 0.08, -0.1);
        g.add(spike);
      }
      eyes(g, 0.75, 0.5, 0.22, 0.11, true);
      break;
    }
  }
  return g;
}

interface Tween {
  t0: number;
  dur: number;
  fn: (k: number) => void; // k in 0..1
  done: () => void;
}

export class Arena {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-4, 4, 3, -3, 0.1, 50);
  pet: THREE.Group;
  enemy: THREE.Group | null = null;
  private readonly fx = new THREE.Group();
  private tweens: Tween[] = [];
  private readonly petHome = new THREE.Vector3(-1.4, 0, 0);
  private readonly enemyHome = new THREE.Vector3(1.4, 0, 0);
  speed = 1;
  thinking = false; // pet sways its head while the coach (Cortex) call runs

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.scene.background = new THREE.Color(0x1b2030);
    this.camera.position.set(0, 5, 8);
    this.camera.lookAt(0, 0.6, 0);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(3, 6, 4);
    this.scene.add(sun);
    const plot = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4, 0.5, 10), mat(0x6aa84f));
    plot.position.y = -0.25;
    this.scene.add(plot);
    this.pet = makePet();
    this.pet.position.copy(this.petHome);
    this.pet.rotation.y = 0.6;
    this.scene.add(this.pet, this.fx);
    window.addEventListener("resize", () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop((t) => this.frame(t));
  }

  resize() {
    const w = this.renderer.domElement.clientWidth || window.innerWidth;
    const h = this.renderer.domElement.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    const half = aspect < 1 ? 3.6 / aspect : 3.6; // keep both fighters in view on a phone
    this.camera.left = -half * aspect;
    this.camera.right = half * aspect;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
  }

  setEnemy(id: ArchetypeId | null) {
    if (this.enemy) this.scene.remove(this.enemy);
    this.enemy = id ? makeEnemy(id) : null;
    if (this.enemy) {
      this.enemy.position.copy(this.enemyHome);
      this.enemy.rotation.y = -0.6;
      this.scene.add(this.enemy);
    }
    this.pet.position.copy(this.petHome);
    this.pet.scale.setScalar(1);
    this.pet.visible = true;
  }

  // Screen position (CSS px) above a fighter, for speech bubbles.
  anchor(who: "pet" | "enemy"): { x: number; y: number } | null {
    const obj = who === "pet" ? this.pet : this.enemy;
    if (!obj || !obj.visible) return null;
    const v = obj.position.clone().add(new THREE.Vector3(0, 1.7, 0)).project(this.camera);
    const el = this.renderer.domElement;
    return { x: ((v.x + 1) / 2) * el.clientWidth, y: ((1 - v.y) / 2) * el.clientHeight };
  }

  private tween(dur: number, fn: (k: number) => void): Promise<void> {
    return new Promise((done) => this.tweens.push({ t0: -1, dur: dur / this.speed, fn, done }));
  }

  private burst(at: THREE.Vector3, color: number, count = 6) {
    for (let i = 0; i < count; i++) {
      const p = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), mat(color));
      p.position.copy(at).add(new THREE.Vector3(0, 0.8, 0));
      const v = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2 + 0.5, (Math.random() - 0.5) * 2);
      this.fx.add(p);
      void this.tween(600, (k) => {
        p.position.addScaledVector(v, 0.016 * this.speed);
        p.scale.setScalar(1 - k);
        if (k >= 1) this.fx.remove(p);
      });
    }
  }

  private lunge(obj: THREE.Group, home: THREE.Vector3, dir: number) {
    return this.tween(350, (k) => {
      obj.position.x = home.x + dir * Math.sin(k * Math.PI) * 1.1;
    });
  }

  private shake(obj: THREE.Group, home: THREE.Vector3) {
    return this.tween(300, (k) => {
      obj.position.x = home.x + Math.sin(k * 40) * 0.08 * (1 - k);
    });
  }

  // One turn: the pet's move, then the enemy's act, matching the order Battle.step resolves them.
  async playTurn(action: Action, enemyAct: EnemyAct, dealt: number, taken: number, outcome: string | null): Promise<void> {
    const pet = this.pet;
    const enemy = this.enemy;
    switch (action) {
      case "attack":
        await this.lunge(pet, this.petHome, 1);
        if (enemy && dealt > 0) {
          this.burst(this.enemyHome, 0xffe599);
          await this.shake(enemy, this.enemyHome);
        }
        break;
      case "guard": {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 6, 24), mat(0x6fa8dc));
        ring.position.copy(this.petHome).add(new THREE.Vector3(0.3, 0.6, 0));
        ring.rotation.y = Math.PI / 2;
        this.fx.add(ring);
        await this.tween(300, (k) => ring.scale.setScalar(0.5 + 0.5 * k));
        setTimeout(() => this.fx.remove(ring), 700 / this.speed);
        break;
      }
      case "emote":
        this.burst(this.petHome, 0xff8fa3, 5);
        await this.tween(450, (k) => {
          pet.position.y = Math.abs(Math.sin(k * Math.PI * 2)) * 0.4;
        });
        break;
      case "befriend":
        await this.tween(400, (k) => {
          pet.position.x = this.petHome.x + Math.sin(k * Math.PI) * 0.5;
        });
        if (outcome === "win") this.burst(this.enemyHome, 0xff8fa3, 10);
        break;
      case "flee":
        await this.tween(300, (k) => {
          pet.rotation.y = 0.6 + k * Math.PI;
        });
        if (outcome === "fled") await this.tween(400, (k) => (pet.position.x = this.petHome.x - k * 4));
        pet.rotation.y = 0.6;
        break;
    }
    if (outcome === "win" && enemy && action !== "befriend") await this.tween(400, (k) => enemy.scale.setScalar(1 - 0.9 * k));
    if (outcome || !enemy) return;
    if (enemyAct === "strike" || enemyAct === "heavy") {
      if (enemyAct === "heavy") await this.tween(250, (k) => enemy.scale.setScalar(1 + 0.25 * Math.sin(k * Math.PI)));
      await this.lunge(enemy, this.enemyHome, -1);
      if (taken > 0) {
        this.burst(this.petHome, 0xe06666, enemyAct === "heavy" ? 10 : 5);
        await this.shake(pet, this.petHome);
      }
    } else if (enemyAct === "guard") {
      const shell = enemy.getObjectByName("shell");
      await this.tween(300, (k) => {
        enemy.scale.y = 1 - 0.25 * Math.sin(k * Math.PI);
        if (shell) shell.scale.setScalar(1 + 0.2 * Math.sin(k * Math.PI));
      });
    } else if (enemyAct === "flee") {
      await this.tween(300, (k) => (enemy.rotation.y = -0.6 + k * Math.PI));
      enemy.rotation.y = -0.6;
    }
  }

  async playEnd(outcome: string): Promise<void> {
    if (outcome === "loss") await this.tween(500, (k) => (this.pet.scale.y = 1 - 0.6 * k));
    else if (outcome === "escaped" && this.enemy) {
      const e = this.enemy;
      await this.tween(400, (k) => (e.position.x = this.enemyHome.x + k * 4));
    } else if (outcome === "win") this.burst(this.petHome, 0xffd966, 12);
  }

  private frame(t: number) {
    const live = this.tweens;
    this.tweens = [];
    for (const tw of live) {
      if (tw.t0 < 0) tw.t0 = t;
      const k = Math.min(1, (t - tw.t0) / tw.dur);
      tw.fn(k);
      if (k >= 1) tw.done();
      else this.tweens.push(tw);
    }
    // Idle breathing.
    this.pet.children[0]!.scale.y = 0.85 + Math.sin(t / 400) * 0.03;
    this.pet.rotation.z = this.thinking ? Math.sin(t / 260) * 0.12 : 0;
    if (this.enemy) this.enemy.children[0]!.scale.y = 1 + Math.sin(t / 470 + 1) * 0.03;
    this.renderer.render(this.scene, this.camera);
  }
}
