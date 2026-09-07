import * as THREE from 'three';

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
