import * as THREE from 'three';

/**
 * IK analítica de dos huesos. Se resuelve por geometría (ley de cosenos), sin
 * iteración: un único cálculo determinista. Pensada para posar UNA vez una
 * pose estática (el jinete), así que no tiene coste por frame.
 *
 * Las longitudes se miden de las posiciones actuales de los huesos, nunca
 * hardcodeadas, así que se adapta sola si cambia el modelo.
 *
 * `pole` decide hacia qué lado dobla el codo o la rodilla.
 */
export function applyTwoBoneIK(
  root: THREE.Object3D,
  mid: THREE.Object3D,
  end: THREE.Object3D,
  target: THREE.Vector3,
  pole: THREE.Vector3,
): void {
  if (!root.parent || !mid.parent) return;

  root.parent.updateWorldMatrix(true, false);
  const rootPos = root.getWorldPosition(new THREE.Vector3());
  const midPos = mid.getWorldPosition(new THREE.Vector3());
  const endPos = end.getWorldPosition(new THREE.Vector3());

  const l1 = rootPos.distanceTo(midPos);
  const l2 = midPos.distanceTo(endPos);
  if (l1 < 1e-6 || l2 < 1e-6) return;

  const bindDir1 = midPos.clone().sub(rootPos).normalize();

  const toTarget = target.clone().sub(rootPos);
  const rawDist = toTarget.length();
  // Clamp dentro del rango alcanzable: evita el caso degenerado (brazo
  // "reventado" a longitud máxima) cuando el objetivo queda fuera de alcance.
  const d = THREE.MathUtils.clamp(rawDist, Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4);
  const aimDir = toTarget.normalize();

  let poleDir = pole.clone().sub(rootPos);
  poleDir.addScaledVector(aimDir, -poleDir.dot(aimDir)); // proyección ortogonal a aimDir
  if (poleDir.lengthSq() < 1e-8) {
    poleDir = new THREE.Vector3(0, 1, 0).cross(aimDir);
    if (poleDir.lengthSq() < 1e-8) poleDir = new THREE.Vector3(1, 0, 0).cross(aimDir);
  }
  poleDir.normalize();

  // Ley de cosenos: ángulo en la raíz entre (raíz->objetivo) y (raíz->media).
  const cosAlpha = THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const alpha = Math.acos(cosAlpha);

  const midDir = aimDir.clone().multiplyScalar(Math.cos(alpha)).addScaledVector(poleDir, Math.sin(alpha));
  const midTarget = rootPos.clone().addScaledVector(midDir, l1);
  const endDir = target.clone().sub(midTarget).normalize();

  // --- Hueso raíz: gira bindDir1 -> midDir (swing mínimo) --------------------
  const rootParentWorldQuat = root.parent.getWorldQuaternion(new THREE.Quaternion());
  const rootWorldQuat = root.getWorldQuaternion(new THREE.Quaternion());
  const swing1 = new THREE.Quaternion().setFromUnitVectors(bindDir1, midDir);
  const newRootWorldQuat = swing1.multiply(rootWorldQuat);
  root.quaternion.copy(rootParentWorldQuat.invert().multiply(newRootWorldQuat));
  root.updateWorldMatrix(true, true);

  // --- Hueso medio: gira su dirección actual -> endDir (swing mínimo) -------
  // mid ya ha heredado el swing de root, así que basta releer dónde ha quedado
  // end respecto a mid en vez de recomponer esa dirección a mano.
  const currentDir2 = end
    .getWorldPosition(new THREE.Vector3())
    .sub(mid.getWorldPosition(new THREE.Vector3()))
    .normalize();
  const midWorldQuatAfterRootSwing = mid.getWorldQuaternion(new THREE.Quaternion());
  const midParentWorldQuat = mid.parent!.getWorldQuaternion(new THREE.Quaternion());
  const swing2 = new THREE.Quaternion().setFromUnitVectors(currentDir2, endDir);
  const newMidWorldQuat = swing2.multiply(midWorldQuatAfterRootSwing);
  mid.quaternion.copy(midParentWorldQuat.invert().multiply(newMidWorldQuat));
  mid.updateWorldMatrix(true, true);
}
