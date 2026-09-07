import * as THREE from 'three';
import { cssColorHex } from '../shared/browser.util';

/** Partículas ambientales que derivan por detrás de la escena. */
export function buildParticleField(count = 140): THREE.Points {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 1] = Math.random() * 5;
    // Z siempre <= -2. El personaje está en z≈0.4 y la moto en z=-1, así que
    // con un reparto más amplio muchas partículas cruzaban por delante.
    positions[i * 3 + 2] = (Math.random() - 0.5) * 6 - 5;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: cssColorHex('--accent', 0x6e7bff),
    size: 0.02,
    transparent: true,
    opacity: 0.5,
  });
  return new THREE.Points(geo, mat);
}
