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

/**
 * Escritorio + silla gaming + MacBook para la escena "programando" de
 * #experience en adelante. Grupo rígido en su propio origen local — lo
 * coloca en mundo `DESK.DESK_GROUP_POSITION/ROTATION_Y` (ver
 * narrative.config.ts), independiente de dónde se sienta el personaje.
 * Mismo lenguaje visual que el resto del atrezo: cajas oscuras + un único
 * acento emisivo (la pantalla).
 */
export function buildDeskSetup(): THREE.Group {
  const g = new THREE.Group();
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x6e7bff,
    emissive: 0x6e7bff,
    emissiveIntensity: 0.85,
    roughness: 0.4,
  });

  // --- Mesa -----------------------------------------------------------
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 0.65), dark(0x151518, 0.7));
  top.position.set(0, 0.75, 0);

  const legGeo = new THREE.BoxGeometry(0.04, 0.75, 0.04);
  const legMat = dark(0x0e0e10);
  const leg = (x: number, z: number) => {
    const l = new THREE.Mesh(legGeo, legMat);
    l.position.set(x, 0.375, z);
    return l;
  };

  // --- MacBook, apoyado sobre la mesa ----------------------------------
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.015, 0.24), dark(0x1c1c22, 0.35, 0.6));
  base.position.set(0, 0.785, -0.02);

  const screenFrame = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.012), dark(0x1c1c22, 0.35, 0.6));
  screenFrame.position.set(0, 0.9, -0.135);
  screenFrame.rotation.x = -0.28;

  const screenGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.29, 0.17), accentMat);
  screenGlow.position.set(0, 0.9, -0.128);
  screenGlow.rotation.x = -0.28;

  // --- Silla gaming: asiento, respaldo inclinado y base -----------------
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.44), dark(0x101012));
  seat.position.set(0, 0.46, 0.55);

  const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.62, 0.06), dark(0x101012));
  backrest.position.set(0, 0.78, 0.75);
  backrest.rotation.x = -0.22;

  const armGeo = new THREE.BoxGeometry(0.05, 0.05, 0.3);
  const armL = new THREE.Mesh(armGeo, dark(0x0e0e10));
  armL.position.set(-0.24, 0.62, 0.55);
  const armR = armL.clone();
  armR.position.x = 0.24;

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 10), dark(0x0e0e10));
  post.position.set(0, 0.21, 0.55);

  const base5 = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 5), dark(0x0c0c0e, 0.5, 0.3));
  base5.position.set(0, 0.01, 0.55);

  g.add(
    top,
    leg(-0.6, -0.28),
    leg(0.6, -0.28),
    leg(-0.6, 0.28),
    leg(0.6, 0.28),
    base,
    screenFrame,
    screenGlow,
    seat,
    backrest,
    armL,
    armR,
    post,
    base5,
  );
  g.traverse((o) => (o.castShadow = true));
  return g;
}

/** Small ambient tech particles drifting behind the hero. */
export function buildParticleField(count = 140): THREE.Points {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 1] = Math.random() * 5;
    // Z siempre <= -2: el personaje vive en Z≈0.4 y la moto en Z=-1 (ver
    // WALK.BASE_Z / MOTORBIKE.WORLD_Z en narrative.config.ts) — con el
    // reparto anterior (-7 a 3) casi un 40% de las partículas caían por
    // delante de ambos y cruzaban por encima al girar el campo. Este rango
    // (-8 a -2) las deja siempre detrás, con margen, para cualquier sección.
    positions[i * 3 + 2] = (Math.random() - 0.5) * 6 - 5;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0x6e7bff, size: 0.02, transparent: true, opacity: 0.5 });
  return new THREE.Points(geo, mat);
}
