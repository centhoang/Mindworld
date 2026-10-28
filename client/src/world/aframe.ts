import * as THREE from "three";
import { PAL, toon } from "../game/style";

// A cozy A-frame cabin for a player's corner: a steep roof down to the ground, a round glowing window,
// and a porch deck with a bench and a lantern. Built in local space facing +z (the door side); the
// caller rotates it to face the island centre. Porch slots and bench seats are given in local space.

export interface AFrame {
  group: THREE.Group;
  porchSlots: { x: number; z: number }[]; // where porch decor stands (4)
  seatPlayer: { x: number; z: number; y: number };
  seatPet: { x: number; z: number; y: number };
  front: number; // local z just past the porch steps (where a visitor stands)
}

const W = 1.45; // half width at the base
const H = 2.7; // ridge height
const D = 2.2; // depth of the cabin
const DECK = 1.25; // porch depth in front of the door

function gable(color: number): THREE.Mesh {
  const s = new THREE.Shape();
  s.moveTo(-W + 0.15, 0);
  s.lineTo(W - 0.15, 0);
  s.lineTo(0, H - 0.25);
  s.closePath();
  return new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false }), toon(color));
}

export function makeAFrame(roof = 0x7fa8f0, wall = 0xf6e2c4): AFrame {
  const g = new THREE.Group();
  const roofDark = new THREE.Color(roof).multiplyScalar(0.85).getHex();
  const ang = Math.atan2(H, W);
  const slope = Math.hypot(W, H) + 0.35;
  for (const s of [-1, 1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(slope, 0.16, D + 0.5), toon(roof));
    slab.position.set((s * W) / 2, H / 2 - 0.05, 0);
    slab.rotation.z = -s * ang;
    g.add(slab);
    // Shingle stripes along the roof.
    for (let i = 1; i < 4; i++) {
      const k = i / 4;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, D + 0.52), toon(roofDark));
      strip.position.set(s * (W - k * W) + s * 0.05, k * H + 0.07, 0);
      strip.rotation.z = -s * ang;
      g.add(strip);
    }
  }
  const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, D + 0.6, 10), toon(roofDark));
  ridge.rotation.x = Math.PI / 2;
  ridge.position.y = H + 0.05;
  g.add(ridge);

  const front = gable(wall);
  front.position.z = D / 2 - 0.12;
  const back = gable(wall);
  back.position.z = -D / 2 + 0.04;
  g.add(front, back);

  // Round window with a warm glow, a little frame and a cross.
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.32, 24), toon(0xffe39a, { emissive: 0xffb84d, emissiveIntensity: 0.75 }));
  glass.position.set(0, 1.55, D / 2 - 0.02);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.055, 8, 28), toon(PAL.woodDark));
  frame.position.copy(glass.position);
  g.add(glass, frame);
  for (const r of [0, Math.PI / 2]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.04, 0.03), toon(PAL.woodDark));
    bar.position.set(0, 1.55, D / 2);
    bar.rotation.z = r;
    g.add(bar);
  }

  // Rounded door.
  const door = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.42, 4, 12), toon(0xb07548));
  door.scale.z = 0.18;
  door.position.set(0, 0.5, D / 2 - 0.02);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), toon(0xffd966));
  knob.position.set(0.15, 0.48, D / 2 + 0.04);
  g.add(door, knob);

  // Porch deck: planks, steps, rail posts.
  const deckZ = D / 2 + DECK / 2;
  for (let i = 0; i < 5; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2 * W + 0.4, 0.12, DECK / 5 - 0.03), toon(i % 2 ? PAL.wood : PAL.woodDark));
    plank.position.set(0, 0.06, D / 2 + (i + 0.5) * (DECK / 5));
    g.add(plank);
  }
  const step = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.3), toon(PAL.wood));
  step.position.set(0, 0.03, D / 2 + DECK + 0.15);
  g.add(step);

  // Bench on the right of the door.
  const bx = 0.95;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.38), toon(PAL.wood));
  seat.position.set(bx, 0.42, D / 2 + 0.32);
  const backrest = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 0.06), toon(PAL.woodDark));
  backrest.position.set(bx, 0.66, D / 2 + 0.14);
  g.add(seat, backrest);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.3), toon(PAL.woodDark));
    leg.position.set(bx + s * 0.42, 0.25, D / 2 + 0.32);
    g.add(leg);
  }
  const cushion = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.2, 4, 10), toon(0xf4a7b9));
  cushion.rotation.z = Math.PI / 2;
  cushion.position.set(bx + 0.35, 0.52, D / 2 + 0.3);
  g.add(cushion);

  // Lantern on a post at the left front corner of the deck.
  const lx = -W - 0.05;
  const lz = D / 2 + DECK - 0.1;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.2, 8), toon(PAL.woodDark));
  post.position.set(lx, 0.6, lz);
  const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), toon(0xffe08a, { emissive: 0xffc94d, emissiveIntensity: 0.9 }));
  lamp.position.set(lx, 1.28, lz);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.12, 8), toon(PAL.woodDark));
  cap.position.set(lx, 1.45, lz);
  g.add(post, lamp, cap);

  return {
    group: g,
    porchSlots: [
      { x: -W - 0.45, z: D / 2 - 0.35 },
      { x: W + 0.45, z: D / 2 - 0.35 },
      { x: -0.75, z: deckZ + 0.15 },
      { x: W + 0.35, z: deckZ + 0.55 },
    ],
    seatPlayer: { x: bx - 0.25, z: D / 2 + 0.36, y: 0.32 },
    seatPet: { x: bx + 0.25, z: D / 2 + 0.38, y: 0.46 },
    front: D / 2 + DECK + 0.6,
  };
}
