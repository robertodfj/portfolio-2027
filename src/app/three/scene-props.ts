import * as THREE from 'three';

const dark = (color: number, roughness = 0.6, metalness = 0.2) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

/** Desk + monitor + keyboard silhouette used in the "coding" staging. */
export function buildDeskProp(): THREE.Group {
  const g = new THREE.Group();

  const desk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.7), dark(0x151518, 0.7));
  desk.position.set(0.9, 0.75, -0.6);
  desk.castShadow = desk.receiveShadow = true;

  const leg = (x: number, z: number) => {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.75, 8), dark(0x0e0e10));
    l.position.set(x, 0.375, z);
    return l;
  };

  const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.03), dark(0x0c0c0e, 0.3, 0.6));
  monitor.position.set(0.9, 1.08, -0.85);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x6e7bff, emissive: 0x6e7bff, emissiveIntensity: 0.9, roughness: 0.4 }),
  );
  screen.position.set(0.9, 1.08, -0.835);

  const keyboard = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.02, 0.12), dark(0x0e0e10));
  keyboard.position.set(0.9, 0.79, -0.55);

  g.add(desk, leg(0.25, -0.9), leg(1.55, -0.9), leg(0.25, -0.3), leg(1.55, -0.3), monitor, screen, keyboard);
  g.traverse((o) => (o.castShadow = true));
  return g;
}

/** Very stylised motorcycle silhouette — two wheels, frame, seat. Intentionally abstract. */
export function buildMotorcycleProp(): THREE.Group {
  const g = new THREE.Group();
  const wheelMat = dark(0x0c0c0e, 0.4, 0.5);
  const frameMat = dark(0x1c1c22, 0.35, 0.6);
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x6e7bff, emissive: 0x6e7bff, emissiveIntensity: 0.25, roughness: 0.3, metalness: 0.6 });

  const wheelGeo = new THREE.TorusGeometry(0.32, 0.055, 12, 28);
  const frontWheel = new THREE.Mesh(wheelGeo, wheelMat);
  frontWheel.position.set(0.75, 0.32, 0);
  frontWheel.rotation.y = Math.PI / 2;
  const rearWheel = frontWheel.clone();
  rearWheel.position.set(-0.55, 0.32, 0);

  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.09, 0.12), frameMat);
  frame.position.set(0.1, 0.55, 0);

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.22), dark(0x101012));
  seat.position.set(-0.35, 0.68, 0);

  const tank = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), accentMat);
  tank.scale.set(1.3, 0.7, 0.8);
  tank.position.set(0.15, 0.72, 0);

  const forkFront = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), frameMat);
  forkFront.position.set(0.75, 0.5, 0);
  forkFront.rotation.z = 0.35;

  g.add(frontWheel, rearWheel, frame, seat, tank, forkFront);
  g.traverse((o) => (o.castShadow = true));
  return g;
}

/** Small ambient tech particles drifting behind the hero. */
export function buildParticleField(count = 140): THREE.Points {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 1] = Math.random() * 5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0x6e7bff, size: 0.02, transparent: true, opacity: 0.5 });
  return new THREE.Points(geo, mat);
}
