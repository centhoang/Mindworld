import * as THREE from "three";

// Placeholder scene so the scaffold renders; the real pet and arena replace this.
const canvas = document.getElementById("stage") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b2030);

const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, 0.1, 50);
camera.position.set(6, 6, 6);
camera.lookAt(0, 0.5, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(3, 6, 2);
scene.add(sun);

const plot = new THREE.Mesh(
  new THREE.CylinderGeometry(3, 3.4, 0.5, 8),
  new THREE.MeshStandardMaterial({ color: 0x6aa84f, flatShading: true }),
);
plot.position.y = -0.25;
scene.add(plot);

const pet = new THREE.Mesh(
  new THREE.IcosahedronGeometry(0.6, 1),
  new THREE.MeshStandardMaterial({ color: 0xf4b183, flatShading: true }),
);
pet.position.y = 0.6;
scene.add(pet);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  const aspect = w / h;
  camera.left = -3 * aspect;
  camera.right = 3 * aspect;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

renderer.setAnimationLoop((t) => {
  pet.position.y = 0.6 + Math.sin(t / 400) * 0.08;
  pet.rotation.y = t / 1500;
  renderer.render(scene, camera);
});
