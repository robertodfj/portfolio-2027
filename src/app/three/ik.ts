import * as THREE from 'three';

/**
 * IK analítica de 2 huesos ("two-bone IK"), la misma técnica que usan los
 * rigs de Unity/Unreal para brazos y piernas. Se resuelve con geometría pura
 * (ley de cosenos) — nada de iteración, nada de convergencia, un único
 * cálculo determinista.
 *
 * Pensada para posarse UNA VEZ sobre una pose estática (el jinete de la
 * moto): no hay coste por frame, ni aquí ni en quien la llama.
 *
 * Cómo funciona, en 3 pasos:
 *   1. Mide las longitudes reales de los dos segmentos a partir de las
 *      posiciones ACTUALES de los huesos (nunca hardcodeadas: si el modelo
 *      cambia, la IK se adapta sola).
 *   2. Resuelve el triángulo (raíz, articulación media, objetivo) con la ley
 *      de cosenos para saber cuánto debe doblarse la articulación media.
 *   3. Gira cada hueso en espacio MUNDO con la rotación mínima que lleva su
 *      dirección actual a la dirección resuelta (swing puro, sin torsión
 *      añadida — apropiado para una pose fija, no para animación). La
 *      dirección de partida de CADA hueso se relee del estado real tras
 *      actualizar las matrices, en vez de recomponerla algebraicamente a
 *      partir de la rotación del padre: es la forma robusta de encadenar dos
 *      swings sin arrastrar un error de signo en la composición.
 *
 * `pole` desambigua hacia qué lado se dobla la articulación media (el codo o
 * la rodilla). Usar la posición ACTUAL de esa articulación en bind pose como
 * pole es un truco simple y robusto: el doblez resultante cae del mismo lado
 * hacia el que el rig ya se inclina de forma natural, sin tener que adivinar
 * a mano qué eje es "hacia fuera" en cada bone.
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
  // `mid` todavía no ha girado por su cuenta, pero SÍ ha heredado el swing de
  // `root` (la actualización de arriba ya propagó ese cambio a sus
  // descendientes): basta con releer dónde ha quedado `end` respecto a `mid`
  // ahora mismo, en vez de recomponer esa dirección a mano.
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
