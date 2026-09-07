import * as THREE from 'three';
import { normalizeHumanoid } from './model-loader.service';
import { applyTwoBoneIK } from './ik';
import { RIDER } from './narrative.config';

/**
 * Roberto montado en la moto: instancia propia, separada del personaje que
 * camina. No hay clip de "conducir" en el GLB, así que es una pose estática
 * colocada una vez — sin AnimationMixer y con coste cero por frame.
 *
 * `scene` debe ser un gltf.scene recién cargado, nunca uno ya en uso.
 *
 * El Group que devuelve se cuelga como hermano del GLB de la moto, así que
 * hereda su giro y su escala por pura jerarquía.
 *
 * Lanza si el GLB no trae los huesos de Mixamo con sus nombres.
 */
export function buildMotorcycleRider(scene: THREE.Group): THREE.Group {
  const group = new THREE.Group();
  group.add(scene);

  scene.traverse((obj: THREE.Object3D) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = false;
      obj.receiveShadow = false;
    }
  });

  // Mismo convenio de escala/origen que el personaje que camina (altura 2,
  // centrado en X/Z, pies en y = -1): las constantes de RIDER están medidas
  // sobre exactamente este sistema de coordenadas.
  normalizeHumanoid(scene);

  group.rotation.y = RIDER.YAW_Y;
  group.updateMatrixWorld(true);

  const bone = (name: string): THREE.Object3D => {
    const found = scene.getObjectByName(name);
    if (!found) throw new Error(`[MotorcycleRider] No se encontró el hueso "${name}" en roberto.glb.`);
    return found;
  };

  const hips = bone('mixamorigHips');
  const spine = bone('mixamorigSpine');
  const neck = bone('mixamorigNeck');

  // --- 1. Sentar: Hips exactamente sobre el asiento --------------------------
  // hips.getWorldPosition ya incluye el YAW (group.rotation.y) aplicado
  // arriba; con group.position aún en el origen, es la posición que Hips
  // ocuparía si el grupo no se desplazase — de ahí sale el offset exacto.
  const hipsAtOrigin = hips.getWorldPosition(new THREE.Vector3());
  group.position.copy(RIDER.SEAT).sub(hipsAtOrigin);
  group.updateMatrixWorld(true);

  // --- 2. Inclinar el torso hacia el manillar --------------------------------
  // Rotación LOCAL adicional sobre el eje lateral (X) del propio hueso Spine
  // — independiente del YAW del grupo, que ya está aplicado en la cadena de
  // ancestros y no interfiere con esta rotación bone-local.
  const lean = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    THREE.MathUtils.degToRad(RIDER.LEAN_DEG),
  );
  spine.quaternion.multiply(lean);
  spine.updateWorldMatrix(true, true);

  // Contra-rotación del cuello: mira al frente pese a la inclinación del
  // torso, como haría un piloto real.
  const neckCounter = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    THREE.MathUtils.degToRad(-RIDER.NECK_COUNTER_DEG),
  );
  neck.quaternion.multiply(neckCounter);
  neck.updateWorldMatrix(true, true);

  // --- 3. Brazos y piernas: IK de 2 huesos hacia manillar/estriberas --------
  // Por defecto el pole es la posición actual de la articulación, que sirve
  // para los brazos porque el codo ya tiene flexión en bind pose. Para las
  // piernas no: de pie el muslo cuelga recto, el pole queda casi alineado con
  // la dirección cadera->estribera y la rodilla puede doblar hacia cualquier
  // lado. Por eso las piernas usan un pole explícito hacia delante.
  const solveLimb = (
    rootName: string,
    midName: string,
    endName: string,
    target: THREE.Vector3,
    pole?: THREE.Vector3,
  ) => {
    const root = bone(rootName);
    const mid = bone(midName);
    const end = bone(endName);
    applyTwoBoneIK(root, mid, end, target, pole ?? mid.getWorldPosition(new THREE.Vector3()));
  };

  const forward = new THREE.Vector3(1, 0, 0); // eje +X: hacia el manillar/rueda delantera
  const kneePole = (hipBoneName: string, lateralSign: number) =>
    bone(hipBoneName)
      .getWorldPosition(new THREE.Vector3())
      .addScaledVector(forward, 0.6)
      .addScaledVector(new THREE.Vector3(0, 0, lateralSign), 0.15);

  // El codo solo necesita abrirse un poco más de lo que da el bind.
  //
  // La base del empuje tiene que ser el PROPIO codo, no el hombro:
  // applyTwoBoneIK resta la posición de la raíz para quedarse con la
  // dirección, así que partiendo del hombro la resta lo cancela y ELBOW_OUT
  // no haría nada.
  const elbowPole = (foreArmBoneName: string, lateralSign: number) =>
    bone(foreArmBoneName)
      .getWorldPosition(new THREE.Vector3())
      .addScaledVector(new THREE.Vector3(0, 0, lateralSign), RIDER.ELBOW_OUT);

  solveLimb(
    'mixamorigLeftArm',
    'mixamorigLeftForeArm',
    'mixamorigLeftHand',
    RIDER.GRIP_L,
    elbowPole('mixamorigLeftForeArm', Math.sign(RIDER.GRIP_L.z) || -1),
  );
  solveLimb(
    'mixamorigRightArm',
    'mixamorigRightForeArm',
    'mixamorigRightHand',
    RIDER.GRIP_R,
    elbowPole('mixamorigRightForeArm', Math.sign(RIDER.GRIP_R.z) || 1),
  );
  solveLimb(
    'mixamorigLeftUpLeg',
    'mixamorigLeftLeg',
    'mixamorigLeftFoot',
    RIDER.PEG_L,
    kneePole('mixamorigLeftUpLeg', Math.sign(RIDER.PEG_L.z) || -1),
  );
  solveLimb(
    'mixamorigRightUpLeg',
    'mixamorigRightLeg',
    'mixamorigRightFoot',
    RIDER.PEG_R,
    kneePole('mixamorigRightUpLeg', Math.sign(RIDER.PEG_R.z) || 1),
  );

  return group;
}
