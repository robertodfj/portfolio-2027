import * as THREE from 'three';
import { normalizeHumanoid } from './model-loader.service';
import { applyTwoBoneIK } from './ik';
import { RIDER } from './narrative.config';

/**
 * Construye a Roberto MONTADO en la moto: una instancia propia, separada del
 * personaje que camina (que sigue viviendo en AnimationService con su propio
 * AnimationMixer intacto). No hay clip de "conducir" en el GLB — según lo
 * pedido, es preferible una pose estática bien colocada a forzar Idle/Walking
 * sobre el asiento, así que aquí no se crea ningún AnimationMixer: es
 * geometría posada una única vez, con coste cero por frame.
 *
 * `scene` debe ser un gltf.scene de roberto.glb recién cargado — nunca el
 * mismo Object3D que ya esté en uso en otra parte de la escena.
 *
 * Devuelve un Group listo para colgar como HERMANO del `inner` de la moto
 * dentro de `spin` (ver MotorbikeProp.attachRider): al vivir en ese mismo
 * espacio local, gira/escala/aparece con la moto de forma automática, sin
 * ningún cálculo adicional por frame — es pura jerarquía de Three.js.
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
  // El pole (referencia de hacia qué lado dobla codo/rodilla) es, por
  // defecto, la posición ACTUAL de la articulación media: el rig ya se dobla
  // de forma natural hacia ese lado en bind pose, así que sirve sin tener que
  // adivinar a mano ningún eje "hacia fuera". Funciona bien para los brazos
  // (el codo SÍ tiene una flexión clara en bind pose), pero NO para las
  // piernas: con el personaje de pie, el muslo cuelga casi perfectamente
  // recto hacia abajo, así que esa referencia queda casi alineada con la
  // propia dirección cadera->estribera — un pole casi degenerado, cuyo
  // resultado depende del ruido de la captura de movimiento del bind pose y
  // puede doblar la rodilla hacia cualquier lado (incluido cruzándola hacia
  // el lado contrario). Las piernas usan en su lugar un pole explícito
  // "hacia delante" de la moto: así la rodilla dobla siempre hacia el
  // manillar, nunca hacia el lado, en ambas piernas por igual.
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

  // El pole del codo SÍ tiene una referencia natural fiable (el propio codo
  // en bind pose, con el torso ya inclinado) — a diferencia de la rodilla no
  // hace falta sustituirlo entero, solo empujarlo hacia fuera un poco más de
  // lo que da el bind, para que el codo se abra en vez de quedar pegado al
  // torso o hundido en el depósito.
  //
  // IMPORTANTE: la base de este empuje tiene que ser la posición del PROPIO
  // codo (mid), no la del hombro (root). `applyTwoBoneIK` resta rootPos del
  // pole para quedarse solo con la dirección — si el pole fuera
  // hombro + desplazamiento, esa resta cancela el hombro y deja un vector
  // puramente lateral cuya MAGNITUD da igual tras normalizar (por eso
  // ELBOW_OUT no tenía ningún efecto al principio). Partiendo del codo, el
  // desplazamiento lateral SÍ cambia la proporción entre "dirección natural
  // del bind" y "empuje hacia fuera", y por tanto el resultado final.
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
