import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const dark = (color: number, roughness = 0.6, metalness = 0.2) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

/**
 * Env map propio para los materiales metálicos de un prop, generado de una
 * RoomEnvironment. Mismo tratamiento que recibe la moto (ver MotorbikeProp) y
 * por el mismo motivo: un material con metalness alto NO tiene componente
 * difusa — solo refleja. Sin nada que reflejar, el aluminio del MacBook se
 * renderizaba prácticamente negro por mucho que se le subiera el color.
 * Se asigna material a material, así que la iluminación del resto de la
 * escena (y el aspecto del personaje) no se toca.
 *
 * Solo a los materiales METÁLICOS (metalness >= 0.5), que son los que lo
 * necesitan: aplicándolo a todos, la RoomEnvironment —que es un estudio
 * claro— levantaba también el tablero y la tapicería y el mueble entero se
 * iba a gris claro, fuera de la paleta oscura del sitio.
 */
function applyPropEnvironment(root: THREE.Object3D, renderer: THREE.WebGLRenderer, intensity: number): void {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envMap = pmrem.fromScene(room, 0.04).texture;
  pmrem.dispose();
  room.traverse((obj: THREE.Object3D) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) mesh.geometry.dispose();
  });

  const seen = new Set<THREE.Material>();
  root.traverse((obj: THREE.Object3D) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const standard = material as THREE.MeshStandardMaterial;
      if (!('envMap' in standard) || seen.has(standard) || standard.metalness < 0.5) continue;
      seen.add(standard);
      standard.envMap = envMap;
      standard.envMapIntensity = intensity;
      standard.needsUpdate = true;
    }
  });
}

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
 * Escritorio + silla gaming + MacBook Air para la escena "programando" de
 * #experience en adelante.
 *
 * SISTEMA DE COORDENADAS — importante: este grupo se coloca EXACTAMENTE sobre
 * el root del personaje (misma posición, misma rotación, misma escala; ver
 * AnimationService.placeDeskGroup), así que todo lo de aquí está en SU espacio
 * local: y = 0 es el suelo bajo sus pies, +Z es hacia donde mira y hacia donde
 * salen sus piernas, +X es su izquierda.
 *
 * Las medidas NO están puestas a ojo: se midieron sobre la pose REAL del clip
 * "Typing" en el navegador (hueso -> root.worldToLocal), y en ese espacio
 * 1 unidad ≈ 1 metro, así que además coinciden con medidas reales de mueble:
 *
 *   cadera   y=0.564  z=0.019      rodillas  y=0.497  z=0.470
 *   manos    y=0.762  z=0.466      pies      y=0.100  z=0.450  (dedos y≈0)
 *   hombros  y≈1.01   z≈0.05       cabeza    y=1.197  z=0.130
 *
 * De ahí salen las tres alturas que mandan sobre todo lo demás:
 *   - asiento  a 0.47  (justo bajo la cadera, silla real: 0.45-0.50)
 *   - tablero  a 0.735 (justo bajo las manos, mesa real: 0.73-0.75)
 *   - teclado del portátil bajo los dedos, con las muñecas en el borde.
 *
 * La versión anterior estaba a ojo y en OTRO origen (el grupo tenía posición
 * propia, desplazada del asiento): la silla acababa DELANTE del personaje —
 * de ahí que las piernas la atravesaran — y el portátil lejos de sus manos.
 */
export function buildDeskSetup(renderer: THREE.WebGLRenderer): THREE.Group {
  const g = new THREE.Group();

  // --- Materiales -------------------------------------------------------
  // El aluminio va deliberadamente CLARO: en gris casi negro (como el resto
  // del atrezo) el portátil se fundía con el fondo y solo se veía la pantalla
  // flotando, sin carcasa — no se leía como un MacBook.
  const alu = new THREE.MeshStandardMaterial({ color: 0xd2d2d8, roughness: 0.26, metalness: 0.88 });
  const aluDark = new THREE.MeshStandardMaterial({ color: 0x5c5d64, roughness: 0.4, metalness: 0.75 });
  const bezel = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.45, metalness: 0.3 });
  const woodTop = new THREE.MeshStandardMaterial({ color: 0x1a1a1f, roughness: 0.55, metalness: 0.15 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x2a2a31, roughness: 0.38, metalness: 0.72 });
  const upholstery = new THREE.MeshStandardMaterial({ color: 0x121216, roughness: 0.78, metalness: 0.08 });
  const upholsteryAlt = new THREE.MeshStandardMaterial({ color: 0x20223a, roughness: 0.72, metalness: 0.1 });
  const accentGlow = new THREE.MeshStandardMaterial({
    color: 0x6e7bff,
    emissive: 0x6e7bff,
    emissiveIntensity: 1.6,
    roughness: 0.4,
  });
  const displayMat = new THREE.MeshStandardMaterial({
    color: 0x0b0e26,
    emissive: 0x5866e8,
    emissiveIntensity: 0.85,
    roughness: 0.22,
  });

  const box = (w: number, h: number, d: number, mat: THREE.Material) =>
    new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

  // ====================== MESA ==========================================
  // Tablero a 0.735: las manos de la pose caen en 0.762, es decir ~2.5 cm por
  // encima de la superficie — exactamente la postura de teclear.
  const TOP_Y = 0.735;
  const TOP_W = 1.3;
  const TOP_D = 0.7;
  const TOP_CX = 0.15; // ligeramente hacia su izquierda, para no invadir la columna de texto
  const TOP_CZ = 0.67; // borde delantero en 0.32: las rodillas (z=0.47, y=0.50) quedan DEBAJO

  const deskTop = box(TOP_W, 0.036, TOP_D, woodTop);
  deskTop.position.set(TOP_CX, TOP_Y - 0.018, TOP_CZ);

  const legGeo = new THREE.BoxGeometry(0.05, TOP_Y - 0.036, 0.05);
  const deskLeg = (x: number, z: number) => {
    const l = new THREE.Mesh(legGeo, steel);
    l.position.set(x, (TOP_Y - 0.036) / 2, z);
    return l;
  };

  // Tira LED bajo el canto delantero: el detalle que más dice "setup gaming".
  const ledStrip = box(TOP_W - 0.14, 0.012, 0.016, accentGlow);
  ledStrip.position.set(TOP_CX, TOP_Y - 0.05, TOP_CZ - TOP_D / 2 + 0.02);

  // ====================== MACBOOK AIR ===================================
  // Medidas reales de un Air de 13": 30.4 x 21.5 cm, base en cuña (0.5 cm
  // delante, 1.7 cm detrás) — la cuña es justo lo que lo hace reconocible.
  const MB_W = 0.304;
  const MB_D = 0.215;
  const MB_CX = 0.1; // centrado entre sus dos manos (x: -0.013 y 0.209)
  const MB_FRONT_Z = 0.4425; // las muñecas (z≈0.466) caen en el reposamuñecas

  const wedge = new THREE.Shape();
  wedge.moveTo(0, 0);
  wedge.lineTo(MB_D, 0);
  wedge.lineTo(MB_D, 0.017);
  wedge.lineTo(0, 0.005);
  wedge.closePath();
  const mbBase = new THREE.Mesh(
    new THREE.ExtrudeGeometry(wedge, { depth: MB_W, bevelEnabled: false, curveSegments: 1 }),
    alu,
  );
  // El perfil se dibuja en XY y se extruye en Z; este giro lleva su X a +Z
  // (profundidad) y la extrusión a -X (ancho), que es como hay que leerlo aquí.
  mbBase.rotation.y = -Math.PI / 2;
  mbBase.position.set(MB_CX + MB_W / 2, TOP_Y, MB_FRONT_Z);

  const keyboard = box(0.262, 0.003, 0.088, bezel);
  keyboard.position.set(MB_CX, TOP_Y + 0.0155, MB_FRONT_Z + 0.135);
  const trackpad = box(0.108, 0.003, 0.072, aluDark);
  trackpad.position.set(MB_CX, TOP_Y + 0.0105, MB_FRONT_Z + 0.048);

  // Tapa: bisagra en el canto trasero de la base, abierta ~17°.
  const LID_H = 0.212;
  const LID_TILT = 0.3;
  const hingeZ = MB_FRONT_Z + MB_D;
  const hingeY = TOP_Y + 0.017;
  const lid = box(MB_W, LID_H, 0.009, alu);
  lid.position.set(
    MB_CX,
    hingeY + (LID_H / 2) * Math.cos(LID_TILT),
    hingeZ + (LID_H / 2) * Math.sin(LID_TILT),
  );
  lid.rotation.x = LID_TILT;

  // Pantalla mirando HACIA él (-Z de la tapa). Cuelga de la tapa, así que
  // hereda su inclinación sin repetir la trigonometría.
  const lidBezel = new THREE.Mesh(new THREE.PlaneGeometry(MB_W - 0.006, LID_H - 0.006), bezel);
  lidBezel.position.set(0, 0, -0.0051);
  lidBezel.rotation.y = Math.PI;
  const display = new THREE.Mesh(new THREE.PlaneGeometry(MB_W - 0.022, LID_H - 0.026), displayMat);
  display.position.set(0, 0, -0.0057);
  display.rotation.y = Math.PI;
  lid.add(lidBezel, display);

  // Luz de pantalla: es lo que vende "programando de noche" — le tiñe cara y
  // manos de azul aunque la pantalla en sí quede de espaldas a la cámara.
  const screenLight = new THREE.PointLight(0x8f99ff, 2.6, 2.6, 2);
  screenLight.position.set(MB_CX, hingeY + 0.16, hingeZ - 0.06);

  // Taza, al lado que da a la cámara — un detalle y no más ruido.
  const mugMat = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.62, metalness: 0.12 });
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.033, 0.095, 18), mugMat);
  mug.position.set(-0.33, TOP_Y + 0.0475, 0.6);
  const mugHandle = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.007, 8, 16), mugMat);
  mugHandle.position.set(-0.285, TOP_Y + 0.05, 0.6);
  mugHandle.rotation.y = Math.PI / 2;

  // ====================== SILLA GAMING ==================================
  // Detrás de él (-Z): antes estaba en +Z, o sea justo donde van las piernas.
  const SEAT_Y = 0.47; // superficie del asiento, justo bajo la cadera (0.564)
  const SEAT_CZ = -0.03;
  const BACK_TILT = 0.218; // ~12.5° de reclinado

  const seatPan = box(0.5, 0.075, 0.52, upholstery);
  seatPan.position.set(0, SEAT_Y - 0.037, SEAT_CZ);

  // Bolsters laterales del asiento (los muslos van en x≈±0.09, libres).
  const seatBolster = (x: number) => {
    const b = box(0.07, 0.09, 0.46, upholstery);
    b.position.set(x, SEAT_Y + 0.005, SEAT_CZ - 0.02);
    return b;
  };

  // Respaldo alto con silueta de baquet: ancho abajo, estrechado arriba y
  // rematado en curva. Es la silueta —no el color— lo que distingue una silla
  // gaming de una de oficina, así que se dibuja el perfil y se extruye en vez
  // de apilar cajas planas.
  const BACK_H = 0.8;
  const backShape = new THREE.Shape();
  backShape.moveTo(-0.24, 0);
  backShape.lineTo(0.24, 0);
  backShape.lineTo(0.19, BACK_H - 0.12);
  backShape.quadraticCurveTo(0.19, BACK_H, 0.11, BACK_H);
  backShape.lineTo(-0.11, BACK_H);
  backShape.quadraticCurveTo(-0.19, BACK_H, -0.19, BACK_H - 0.12);
  backShape.closePath();
  const backGeo = new THREE.ExtrudeGeometry(backShape, {
    depth: 0.075,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 8,
  });
  backGeo.translate(0, 0, -0.0375); // grosor centrado sobre el plano del respaldo

  // El pivote del respaldo es su BASE, en el canto trasero del asiento: así
  // reclinarlo es girar sobre X y ya está, sin recolocar el centro a mano.
  const backrest = new THREE.Mesh(backGeo, upholstery);
  backrest.position.set(0, SEAT_Y, SEAT_CZ - 0.22);
  backrest.rotation.x = -BACK_TILT;

  // Alas, reposacabezas, cojín lumbar y franjas de acento cuelgan del propio
  // respaldo: heredan su reclinado en vez de repetir la trigonometría cada uno
  // (que es justo lo que antes los dejaba flotando descolgados).
  const wing = (x: number) => {
    const w = box(0.07, 0.6, 0.13, upholstery);
    w.position.set(x, 0.36, 0.055);
    return w;
  };
  const stripe = (x: number) => {
    const s = box(0.016, 0.46, 0.012, accentGlow);
    s.position.set(x, 0.37, 0.127);
    return s;
  };
  const headrest = box(0.26, 0.13, 0.11, upholsteryAlt);
  headrest.position.set(0, BACK_H - 0.02, 0.045);
  const lumbar = box(0.3, 0.15, 0.08, upholsteryAlt);
  lumbar.position.set(0, 0.2, 0.075);
  backrest.add(wing(0.22), wing(-0.22), stripe(0.22), stripe(-0.22), headrest, lumbar);

  // Reposabrazos: por debajo de sus codos (y≈0.78), sin tocarlos.
  const armrest = (x: number) => {
    const pad = box(0.09, 0.036, 0.26, upholstery);
    pad.position.set(x, 0.682, SEAT_CZ + 0.01);
    const post = box(0.045, 0.2, 0.055, steel);
    post.position.set(x, 0.565, SEAT_CZ - 0.06);
    return [pad, post];
  };

  const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.05, 0.3, 14), steel);
  piston.position.set(0, 0.28, SEAT_CZ);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.06, 14), steel);
  hub.position.set(0, 0.1, SEAT_CZ);

  const baseParts: THREE.Object3D[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.35;
    const spoke = box(0.05, 0.036, 0.3, steel);
    spoke.position.set(Math.sin(a) * 0.15, 0.085, SEAT_CZ + Math.cos(a) * 0.15);
    spoke.rotation.y = a;

    const caster = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.022, 12), steel);
    caster.position.set(Math.sin(a) * 0.3, 0.032, SEAT_CZ + Math.cos(a) * 0.3);
    caster.rotation.set(0, a, Math.PI / 2);
    baseParts.push(spoke, caster);
  }

  g.add(
    deskTop,
    deskLeg(TOP_CX - 0.59, TOP_CZ - 0.29),
    deskLeg(TOP_CX + 0.59, TOP_CZ - 0.29),
    deskLeg(TOP_CX - 0.59, TOP_CZ + 0.29),
    deskLeg(TOP_CX + 0.59, TOP_CZ + 0.29),
    ledStrip,
    mbBase,
    keyboard,
    trackpad,
    lid,
    screenLight,
    mug,
    mugHandle,
    seatPan,
    seatBolster(0.245),
    seatBolster(-0.245),
    backrest,
    ...armrest(0.31),
    ...armrest(-0.31),
    piston,
    hub,
    ...baseParts,
  );

  // Sin sombras a propósito: el plano de suelo de la escena está en y = -1.02,
  // un metro por debajo de los pies, así que cualquier sombra proyectada cae
  // despegada del mueble. Mejor ninguna que una flotando.
  g.traverse((o) => {
    o.castShadow = false;
    o.receiveShadow = false;
  });

  applyPropEnvironment(g, renderer, 0.45);
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
