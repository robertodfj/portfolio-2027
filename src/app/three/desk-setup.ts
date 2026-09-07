import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Puesto de trabajo (mesa + silla gaming + MacBook + atrezo) de la escena
 * "programando", de #experience en adelante.
 *
 * SISTEMA DE COORDENADAS — importante: este grupo se coloca EXACTAMENTE sobre
 * el root del personaje (misma posición, misma rotación, misma escala; ver
 * AnimationService), así que todo lo de aquí está en SU espacio local: y = 0 es
 * el suelo bajo sus pies, +Z es hacia donde mira y hacia donde salen sus
 * piernas, +X es su izquierda.
 *
 * Las medidas NO están puestas a ojo: se midieron sobre la pose REAL del clip
 * "Typing" en el navegador (hueso -> root.worldToLocal), y en ese espacio
 * 1 unidad ≈ 1 metro, así que además coinciden con medidas reales de mueble:
 *
 *   cadera   y=0.564  z=0.019      rodillas  y=0.497  z=0.470
 *   muñecas  y=0.762  z=0.466      pies      y=0.100  z=0.450  (dedos y≈0)
 *   hombros  y≈1.01   z≈0.05       cabeza    y=1.197  z=0.130
 *
 * De ahí salen las alturas que mandan sobre todo lo demás: asiento a 0.47
 * (justo bajo la cadera), tablero a 0.725 y teclado del portátil justo bajo
 * los dedos, con las muñecas cayendo en el reposamuñecas.
 */

/** ---------------------------------------------------------------------
 *  Medidas del puesto. Todo lo demás se deriva de aquí.
 *  ------------------------------------------------------------------ */
const DESK = {
  TOP_Y: 0.725,
  W: 1.42,
  D: 0.72,
  CX: 0.16,
  CZ: 0.7, // tablero de z=0.34 a z=1.06: las rodillas (z=0.47) quedan debajo
  THICK: 0.038,
};

const MB = {
  /**
   * Un MacBook Air de 13" real mide 30.4 x 21.5 cm. Aquí va a 40 x 27.5, un
   * ~30% por encima: a petición explícita ("el mac sale muy pequeño"). A la
   * distancia de cámara de esta escena el tamaño real se leía como un
   * accesorio diminuto; agrandarlo es la misma licencia que se toma cualquier
   * bodegón de producto. Lo que NO se puede tocar es dónde cae el teclado:
   * tiene que quedar bajo sus dedos, así que el portátil crece hacia ADELANTE
   * (borde delantero más cerca de él) y hacia los lados, nunca desplazando la
   * zona de tecleo.
   */
  W: 0.4,
  D: 0.275,
  CX: 0.1, // centrado entre sus dos manos (x: -0.013 y 0.209)

  /**
   * Borde delantero. Retrasado 1.5 cm (≈2% del fondo de la mesa) a petición
   * explícita: al teclear, los dedos atravesaban la pantalla.
   *
   * No es un ajuste a ojo — está medido. Muestreando el bucle de "Typing"
   * durante 4 s (corre en tiempo real, así que la mano NO está siempre donde
   * la deja un único fotograma), los 32 huesos de mano y dedos alcanzan como
   * máximo z = 0.6651 (RightHandMiddle3, a y = 0.827). Con FRONT_Z = 0.385 la
   * bisagra caía en z = 0.660: los dedos se metían 5 mm dentro de la tapa en
   * su parte baja, justo donde la pantalla aún no ha empezado a irse hacia
   * atrás. Con 0.40 la bisagra queda en 0.675 y sobran ~9 mm en el punto más
   * justo (arriba, donde la tapa ya se aleja, el margen sube a ~2.8 cm).
   *
   * SEGUNDA VUELTA (a petición: "échalo más para atrás"). 0.45 no es solo
   * "otro poco": es la posición donde la geometría cuadra del todo. Con las
   * proporciones de teclado corregidas (ver KEYS_*), el teclado ocupa de
   * z=0.546 a z=0.673, y las puntas de los dedos barren de 0.628 a 0.665 —
   * o sea que caen DENTRO de las teclas en vez de sobre el canto trasero,
   * que es donde quedaban antes. Y la muñeca (z=0.477) aterriza a 2.7 cm del
   * borde delantero, justo en el reposamuñecas.
   *
   * La bisagra sube a z=0.725: 6 cm de margen contra los dedos, frente al 1 cm
   * justo de la vuelta anterior.
   *
   * TOPE por este lado: pasado z≈0.487 la muñeca se sale por delante del
   * portátil y se quedaría tecleando en el aire.
   */
  FRONT_Z: 0.45,

  /**
   * Teclado y trackpad como fracción del fondo, con las proporciones REALES
   * de un MacBook: el teclado va del 35% al 81% del fondo (centro al 58%) y
   * el trackpad al 20%. Antes estaba centrado al 70% y por eso las manos
   * caían siempre sobre el canto de atrás.
   */
  KEYS_CENTER: 0.58,
  KEYS_DEPTH: 0.46,
  TRACKPAD_CENTER: 0.2,
  /** Cuña del Air: 0.7 cm delante, 2.2 cm detrás. */
  FRONT_T: 0.007,
  BACK_T: 0.022,
  SCREEN_H: 0.255, // 16:10 sobre el ancho, como el panel real
  TILT: 0.3, // ~17° de apertura respecto a la vertical
};

const CHAIR = {
  SEAT_Y: 0.47, // superficie, justo bajo la cadera (0.564)
  CZ: -0.03,
  BACK_H: 0.82,
  BACK_TILT: 0.2,
};

/** ---------------------------------------------------------------------
 *  Utilidades de geometría
 *  ------------------------------------------------------------------ */

/**
 * Caja con esquinas redondeadas y cantos biselados: perfil en XY extruido en
 * Z. Es la pieza clave del salto de realismo — una BoxGeometry pelada tiene
 * los cantos infinitamente vivos y NUNCA capta un brillo especular, que es
 * justo lo que hace que un render se lea como "cajas" en vez de como objetos.
 */
function roundedBoxGeometry(w: number, h: number, d: number, radius: number): THREE.ExtrudeGeometry {
  const r = Math.max(0.0005, Math.min(radius, w / 2 - 0.001, h / 2 - 0.001));
  const x = -w / 2;
  const y = -h / 2;

  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);

  const bevel = Math.min(0.004, d * 0.28);
  const depth = Math.max(d - bevel * 2, 0.0006);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 4,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

/** Panel vertical redondeado: ancho en X, alto en Y, grosor en Z. */
function panel(w: number, h: number, t: number, r: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(roundedBoxGeometry(w, h, t, r), mat);
}

/** Losa horizontal redondeada: ancho en X, fondo en Z, grosor en Y. */
function slab(w: number, d: number, t: number, r: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(roundedBoxGeometry(w, d, t, r), mat);
  m.rotation.x = -Math.PI / 2;
  return m;
}

/** ---------------------------------------------------------------------
 *  Texturas procedurales (canvas). Sin ellas, todo material liso se lee como
 *  plástico: son lo que da tela a la tapicería y teclas al portátil.
 *  ------------------------------------------------------------------ */

function makeTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  srgb = true,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!, w, h);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Teclado tipo isla: teclas oscuras con el canto superior iluminado. */
function keyboardTexture(): THREE.CanvasTexture {
  return makeTexture(512, 320, (ctx) => {
    ctx.fillStyle = '#08080a';
    ctx.fillRect(0, 0, 512, 320);

    const cols = 14;
    const rows = 5;
    const pad = 12;
    const kw = (512 - pad * 2) / cols;
    const kh = (320 - pad * 2) / rows;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        let x = pad + col * kw + 2.5;
        let w = kw - 5;
        // Última fila: una sola barra espaciadora en lugar de seis teclas.
        if (row === rows - 1) {
          if (col > 4 && col < 10) continue;
          if (col === 4) w = kw * 6 - 5;
        }
        const y = pad + row * kh + 2.5;
        const h = kh - 5;

        ctx.fillStyle = '#191920';
        roundRectPath(ctx, x, y, w, h, 4);
        ctx.fill();
        ctx.fillStyle = '#24242c';
        roundRectPath(ctx, x, y, w, h * 0.4, 4);
        ctx.fill();
      }
    }
  });
}

/** Ruido fino para tapicería: se usa de bumpMap, no de color. */
function fabricTexture(): THREE.CanvasTexture {
  const texture = makeTexture(
    256,
    256,
    (ctx, w, h) => {
      const image = ctx.createImageData(w, h);
      for (let i = 0; i < image.data.length; i += 4) {
        const v = 118 + Math.random() * 44;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
        image.data[i + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
    },
    false,
  );
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 5);
  return texture;
}

/** Vetas horizontales suaves para el tablero: rompe el negro plano. */
function deskGrainTexture(): THREE.CanvasTexture {
  const texture = makeTexture(
    512,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#8a8a8a';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        const y = Math.random() * h;
        ctx.strokeStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.05})`;
        ctx.lineWidth = 0.5 + Math.random();
        ctx.beginPath();
        ctx.moveTo(Math.random() * w, y);
        ctx.lineTo(Math.random() * w, y + (Math.random() - 0.5) * 2);
        ctx.stroke();
      }
    },
    false,
  );
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1);
  return texture;
}

/** ---------------------------------------------------------------------
 *  Env map — solo para los metales
 *  ------------------------------------------------------------------ */

/**
 * Env map propio para los materiales metálicos, generado de una
 * RoomEnvironment. Mismo tratamiento que recibe la moto (ver MotorbikeProp) y
 * por el mismo motivo: un material con metalness alto NO tiene componente
 * difusa — solo refleja. Sin nada que reflejar, el aluminio del MacBook se
 * renderiza prácticamente negro por mucho que se le suba el color.
 *
 * Solo a los materiales METÁLICOS (metalness >= 0.5): aplicándolo a todos, la
 * RoomEnvironment —que es un estudio claro— levanta también el tablero y la
 * tapicería y el mueble entero se va a gris claro, fuera de la paleta oscura
 * del sitio.
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

/** ---------------------------------------------------------------------
 *  El puesto completo
 *  ------------------------------------------------------------------ */
export function buildDeskSetup(renderer: THREE.WebGLRenderer): THREE.Group {
  const g = new THREE.Group();

  const grain = deskGrainTexture();
  const fabric = fabricTexture();

  // --- Materiales -------------------------------------------------------
  // El aluminio va deliberadamente CLARO y muy metálico: es lo único de la
  // escena que debe destacar sobre el fondo oscuro (con el env map de arriba,
  // que es lo que le da el reflejo).
  const alu = new THREE.MeshStandardMaterial({ color: 0xd6d6dc, roughness: 0.22, metalness: 0.92 });
  const aluDark = new THREE.MeshStandardMaterial({ color: 0x4e4f56, roughness: 0.35, metalness: 0.8 });
  const black = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.45, metalness: 0.25 });
  const deskTopMat = new THREE.MeshStandardMaterial({
    color: 0x15151a,
    roughness: 0.5,
    metalness: 0.2,
    roughnessMap: grain,
  });
  const steel = new THREE.MeshStandardMaterial({ color: 0x2b2b33, roughness: 0.35, metalness: 0.75 });
  const upholstery = new THREE.MeshStandardMaterial({
    color: 0x131318,
    roughness: 0.85,
    metalness: 0.04,
    bumpMap: fabric,
    bumpScale: 0.012,
  });
  const upholsteryAlt = new THREE.MeshStandardMaterial({
    color: 0x1e2038,
    roughness: 0.8,
    metalness: 0.05,
    bumpMap: fabric,
    bumpScale: 0.012,
  });
  const accentGlow = new THREE.MeshStandardMaterial({
    color: 0x6e7bff,
    emissive: 0x6e7bff,
    emissiveIntensity: 1.7,
    roughness: 0.4,
  });
  const displayMat = new THREE.MeshStandardMaterial({
    color: 0x0a0d24,
    emissive: 0x5866e8,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });
  const keysMat = new THREE.MeshStandardMaterial({ map: keyboardTexture(), roughness: 0.7, metalness: 0.15 });

  // ====================== MESA ==========================================
  const top = slab(DESK.W, DESK.D, DESK.THICK, 0.012, deskTopMat);
  top.position.set(DESK.CX, DESK.TOP_Y - DESK.THICK / 2, DESK.CZ);

  // Patas de tubo rectangular, retranqueadas del canto como en una mesa real.
  const legH = DESK.TOP_Y - DESK.THICK;
  const legX = DESK.W / 2 - 0.07;
  const legZ = DESK.D / 2 - 0.07;
  const deskLeg = (sx: number, sz: number) => {
    const l = panel(0.05, legH, 0.05, 0.008, steel);
    l.position.set(DESK.CX + sx * legX, legH / 2, DESK.CZ + sz * legZ);
    return l;
  };

  // Travesaño trasero entre patas: lo que impide que se lea como cuatro
  // palos sueltos flotando bajo un tablero.
  const crossbar = panel(DESK.W - 0.2, 0.035, 0.035, 0.008, steel);
  crossbar.position.set(DESK.CX, 0.12, DESK.CZ + legZ);

  // Tira LED bajo el canto delantero: el detalle que más dice "setup gaming".
  const led = panel(DESK.W - 0.16, 0.012, 0.014, 0.005, accentGlow);
  led.position.set(DESK.CX, DESK.TOP_Y - DESK.THICK - 0.012, DESK.CZ - DESK.D / 2 + 0.025);

  // Alfombrilla grande de tela. Además de ser el accesorio que más grita
  // "puesto de verdad", cumple una función de render: rompe el plano negro
  // liso del tablero, que sin nada encima se lee como una superficie vacía.
  const matMat = new THREE.MeshStandardMaterial({
    color: 0x191a21,
    roughness: 0.92,
    metalness: 0.03,
    bumpMap: fabric,
    bumpScale: 0.01,
  });
  const deskPad = slab(0.92, 0.44, 0.004, 0.012, matMat);
  deskPad.position.set(MB.CX, DESK.TOP_Y + 0.002, 0.56);
  // Un pelo más grande y justo debajo: asoma como un ribete cosido de acento.
  // Con el emisivo a tope (el mismo accentGlow de la tira LED) se leía como un
  // neón rectangular sobre la mesa, así que aquí va una versión atenuada.
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x3d45a8,
    emissive: 0x6e7bff,
    emissiveIntensity: 0.32,
    roughness: 0.6,
  });
  const padTrim = slab(0.93, 0.45, 0.0035, 0.014, trimMat);
  padTrim.position.set(MB.CX, DESK.TOP_Y + 0.0018, 0.56);
  g.add(padTrim, deskPad);

  // ====================== MACBOOK =======================================
  const mb = new THREE.Group();
  // Apoyado SOBRE la alfombrilla, no sobre el tablero.
  const mbBaseY = DESK.TOP_Y + 0.004;

  // Base en cuña: perfil lateral (fondo x altura) extruido a lo ancho. La cuña
  // es lo que hace reconocible a un Air; con una caja recta es un portátil
  // genérico.
  const wedge = new THREE.Shape();
  wedge.moveTo(0.006, 0);
  wedge.lineTo(MB.D - 0.006, 0);
  wedge.quadraticCurveTo(MB.D, 0, MB.D, 0.006);
  wedge.lineTo(MB.D, MB.BACK_T);
  wedge.lineTo(0.004, MB.FRONT_T);
  wedge.quadraticCurveTo(0, MB.FRONT_T, 0, MB.FRONT_T - 0.004);
  wedge.closePath();

  const baseGeo = new THREE.ExtrudeGeometry(wedge, {
    depth: MB.W - 0.008,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
    curveSegments: 4,
  });
  const mbBase = new THREE.Mesh(baseGeo, alu);
  // El perfil se dibuja en XY y se extruye en Z; este giro lleva su X a +Z
  // (fondo) y la extrusión a -X (ancho), que es como hay que leerlo aquí.
  mbBase.rotation.y = -Math.PI / 2;
  mbBase.position.set(MB.CX + (MB.W - 0.008) / 2, mbBaseY, MB.FRONT_Z);
  mb.add(mbBase);

  // Teclado y trackpad. El teclado va en un PlaneGeometry y no en una caja
  // redondeada a propósito: ExtrudeGeometry genera las UV a partir de las
  // coordenadas del perfil (no normalizadas a 0..1), así que la textura de
  // teclas saldría estirada; un plano trae sus UV correctas.
  const keys = new THREE.Mesh(new THREE.PlaneGeometry(MB.W - 0.055, MB.D * MB.KEYS_DEPTH), keysMat);
  keys.rotation.x = -Math.PI / 2;
  keys.position.set(MB.CX, mbBaseY + MB.BACK_T - 0.0035, MB.FRONT_Z + MB.D * MB.KEYS_CENTER);
  const trackpad = slab(MB.W * 0.3, MB.D * 0.26, 0.003, 0.006, aluDark);
  trackpad.position.set(MB.CX, mbBaseY + MB.FRONT_T + 0.004, MB.FRONT_Z + MB.D * MB.TRACKPAD_CENTER);
  mb.add(keys, trackpad);

  // Bisagra y tapa.
  const hingeZ = MB.FRONT_Z + MB.D;
  const hingeY = mbBaseY + MB.BACK_T;
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, MB.W - 0.03, 12), aluDark);
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(MB.CX, hingeY - 0.004, hingeZ - 0.006);
  mb.add(hinge);

  const lid = panel(MB.W, MB.SCREEN_H, 0.011, 0.014, alu);
  lid.position.set(
    MB.CX,
    hingeY + (MB.SCREEN_H / 2) * Math.cos(MB.TILT),
    hingeZ + (MB.SCREEN_H / 2) * Math.sin(MB.TILT),
  );
  lid.rotation.x = MB.TILT;

  // Marco y pantalla miran HACIA él (-Z de la tapa). Cuelgan de la tapa, así
  // que heredan su inclinación sin repetir la trigonometría.
  const bezel = new THREE.Mesh(new THREE.PlaneGeometry(MB.W - 0.008, MB.SCREEN_H - 0.008), black);
  bezel.position.set(0, 0, -0.0061);
  bezel.rotation.y = Math.PI;
  const display = new THREE.Mesh(new THREE.PlaneGeometry(MB.W - 0.026, MB.SCREEN_H - 0.03), displayMat);
  display.position.set(0, 0.004, -0.0066);
  display.rotation.y = Math.PI;
  // Marca discreta en la espalda de la tapa (es lo único que se ve de ella
  // desde cámara): un círculo mate, sin emisión ni logo de nadie.
  const mark = new THREE.Mesh(new THREE.CircleGeometry(0.026, 24), aluDark);
  mark.position.set(0, 0.01, 0.0061);
  lid.add(bezel, display, mark);
  mb.add(lid);

  // Pies de goma.
  const footGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.003, 10);
  for (const sx of [-1, 1]) {
    for (const sz of [0.06, MB.D - 0.06]) {
      const foot = new THREE.Mesh(footGeo, black);
      foot.position.set(MB.CX + sx * (MB.W / 2 - 0.04), mbBaseY - 0.0015, MB.FRONT_Z + sz);
      mb.add(foot);
    }
  }

  // Luz de pantalla: es lo que vende "programando de noche" — le tiñe cara y
  // manos de azul aunque el panel quede de espaldas a la cámara.
  const screenLight = new THREE.PointLight(0x8f99ff, 3, 2.8, 2);
  screenLight.position.set(MB.CX, hingeY + 0.18, hingeZ - 0.08);
  mb.add(screenLight);
  g.add(mb);

  // ====================== SILLA GAMING ==================================
  // Detrás de él (-Z): sus piernas salen hacia +Z.
  const chair = new THREE.Group();

  // Asiento contorneado: base + dos bolsters laterales inclinados hacia
  // dentro (el "baquet" de las sillas gaming) + canales de costura.
  const seatPan = slab(0.52, 0.5, 0.1, 0.05, upholstery);
  seatPan.position.set(0, CHAIR.SEAT_Y - 0.05, CHAIR.CZ);
  chair.add(seatPan);

  for (const sx of [-1, 1]) {
    const bolster = slab(0.1, 0.44, 0.1, 0.045, upholstery);
    bolster.position.set(sx * 0.235, CHAIR.SEAT_Y - 0.02, CHAIR.CZ - 0.02);
    bolster.rotation.z = -sx * 0.16;
    chair.add(bolster);
  }
  for (const dz of [-0.12, 0, 0.12]) {
    const seam = slab(0.34, 0.008, 0.004, 0.002, black);
    seam.position.set(0, CHAIR.SEAT_Y + 0.001, CHAIR.CZ + dz);
    chair.add(seam);
  }

  // Respaldo con silueta de baquet: ancho abajo, estrechado arriba y rematado
  // en curva. Es la silueta —no el color— lo que distingue una silla gaming de
  // una de oficina, así que se dibuja el perfil y se extruye.
  const backShape = new THREE.Shape();
  backShape.moveTo(-0.25, 0);
  backShape.lineTo(0.25, 0);
  backShape.lineTo(0.2, CHAIR.BACK_H - 0.14);
  backShape.quadraticCurveTo(0.2, CHAIR.BACK_H, 0.11, CHAIR.BACK_H);
  backShape.lineTo(-0.11, CHAIR.BACK_H);
  backShape.quadraticCurveTo(-0.2, CHAIR.BACK_H, -0.2, CHAIR.BACK_H - 0.14);
  backShape.closePath();
  const backGeo = new THREE.ExtrudeGeometry(backShape, {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.018,
    bevelSegments: 3,
    curveSegments: 10,
  });
  backGeo.translate(0, 0, -0.035);

  // El pivote del respaldo es su BASE, en el canto trasero del asiento: así
  // reclinarlo es girar sobre X y ya está, sin recolocar el centro a mano.
  const backrest = new THREE.Mesh(backGeo, upholstery);
  backrest.position.set(0, CHAIR.SEAT_Y - 0.02, CHAIR.CZ - 0.22);
  backrest.rotation.x = -CHAIR.BACK_TILT;
  chair.add(backrest);

  // Todo lo que va sobre el respaldo cuelga de él: hereda el reclinado en vez
  // de repetir la trigonometría pieza por pieza (que es lo que antes las
  // dejaba flotando descolgadas).
  // Alas laterales, giradas hacia dentro para que envuelvan en vez de quedar
  // como dos tablones paralelos, con su filete de acento en el canto.
  for (const sx of [-1, 1]) {
    const wing = panel(0.085, 0.62, 0.15, 0.04, upholstery);
    wing.position.set(sx * 0.225, 0.4, 0.06);
    wing.rotation.y = -sx * 0.14;
    backrest.add(wing);

    const piping = panel(0.016, 0.5, 0.01, 0.005, accentGlow);
    piping.position.set(sx * 0.222, 0.4, 0.142);
    piping.rotation.y = -sx * 0.14;
    backrest.add(piping);
  }

  // Costuras horizontales: convierten un panel liso en un respaldo acolchado.
  for (const y of [0.16, 0.34, 0.52, 0.68]) {
    const seam = panel(0.3, 0.008, 0.006, 0.003, black);
    seam.position.set(0, y, 0.05);
    backrest.add(seam);
  }

  const headrest = panel(0.28, 0.15, 0.13, 0.06, upholsteryAlt);
  headrest.position.set(0, CHAIR.BACK_H - 0.04, 0.055);
  backrest.add(headrest);

  const lumbar = panel(0.3, 0.17, 0.11, 0.055, upholsteryAlt);
  lumbar.position.set(0, 0.19, 0.07);
  backrest.add(lumbar);

  // Correas elásticas de los cojines: detalle pequeño, muy reconocible.
  for (const sx of [-1, 1]) {
    for (const [y, h] of [
      [CHAIR.BACK_H - 0.04, 0.16],
      [0.19, 0.18],
    ] as const) {
      const strap = panel(0.022, h, 0.008, 0.004, black);
      strap.position.set(sx * 0.1, y, 0.045);
      backrest.add(strap);
    }
  }

  // Reposabrazos: por debajo de sus codos (y≈0.78), sin tocarlos.
  for (const sx of [-1, 1]) {
    const pad = slab(0.095, 0.28, 0.038, 0.018, upholstery);
    pad.position.set(sx * 0.315, 0.7, CHAIR.CZ + 0.01);
    const post = panel(0.05, 0.19, 0.06, 0.012, steel);
    post.position.set(sx * 0.315, 0.59, CHAIR.CZ - 0.05);
    chair.add(pad, post);
  }

  // Mecanismo, pistón de dos tramos y base de 5 radios con ruedas.
  const mech = slab(0.22, 0.26, 0.075, 0.02, steel);
  mech.position.set(0, 0.375, CHAIR.CZ);
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.17, 16), steel);
  sleeve.position.set(0, 0.2, CHAIR.CZ);
  const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.16, 14), aluDark);
  piston.position.set(0, 0.33, CHAIR.CZ);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.055, 16), steel);
  hub.position.set(0, 0.095, CHAIR.CZ);
  chair.add(mech, sleeve, piston, hub);

  // Cada radio vive en su propio grupo girado: componer el "túmbalo y luego
  // oriéntalo" en un solo Euler daría el orden de giros equivocado.
  for (let i = 0; i < 5; i++) {
    const arm = new THREE.Group();
    arm.position.set(0, 0, CHAIR.CZ);
    arm.rotation.y = (i / 5) * Math.PI * 2 + 0.35;

    const spoke = slab(0.055, 0.3, 0.045, 0.016, steel);
    spoke.position.set(0, 0.085, 0.16);

    const fork = panel(0.052, 0.065, 0.032, 0.012, steel);
    fork.position.set(0, 0.062, 0.3);

    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.024, 16), black);
    wheel.rotation.z = Math.PI / 2; // eje horizontal, perpendicular al radio
    wheel.position.set(0, 0.032, 0.3);

    arm.add(spoke, fork, wheel);
    chair.add(arm);
  }
  g.add(chair);

  // ====================== ATREZO ========================================
  // Poco y reconocible: lo justo para que se lea como un puesto de verdad y no
  // como una mesa de catálogo. Todo al lado que da a cámara (-X es su derecha)
  // salvo los cascos, que ocupan el hueco libre del otro lado.
  // Cerámica algo más clara que el resto del atrezo: en negro sobre negro la
  // taza se leía como un borrón junto a su mano.
  const mugMat = new THREE.MeshStandardMaterial({ color: 0x33343e, roughness: 0.38, metalness: 0.15 });
  /**
   * La taza va agrupada para poder recolocarla de un solo sitio, y su sitio
   * NO se elige a ojo. Estaba en (-0.30, 0.62), a 30 cm de su mano derecha en
   * 3D, y aun así parecía que la agarraba como un ratón: es un solape de
   * PROYECCIÓN, no de posición. La cámara mira esta escena en diagonal (su
   * dirección, en coordenadas locales, es ≈ (0.58, -0.81)), así que lo que
   * decide dónde cae algo en pantalla no es su X sino 0.81·x + 0.58·z:
   *
   *   taza en (-0.30, 0.62)  ->  0.118      mano derecha  ->  0.267
   *
   * Solo 0.15 de separación, con la taza además más cerca de cámara y por
   * tanto más grande: se le montaba encima de la mano. En (-0.48, 0.44) el
   * valor baja a -0.13, que cae en el tablero libre a la derecha de su
   * silueta (el hombro derecho está en -0.06) — bien lejos de las dos manos.
   */
  const mugGroup = new THREE.Group();
  mugGroup.position.set(-0.48, DESK.TOP_Y, 0.44);

  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.036, 0.1, 24), mugMat);
  mug.position.y = 0.05;
  const coffee = new THREE.Mesh(
    new THREE.CircleGeometry(0.037, 20),
    new THREE.MeshStandardMaterial({ color: 0x120c08, roughness: 0.25 }),
  );
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.088;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 10, 20), mugMat);
  handle.position.set(-0.05, 0.052, 0);
  handle.rotation.y = Math.PI / 2;

  mugGroup.add(mug, coffee, handle);
  g.add(mugGroup);

  // Libreta con goma elástica.
  const notebook = slab(0.17, 0.23, 0.022, 0.008, new THREE.MeshStandardMaterial({ color: 0x101018, roughness: 0.7 }));
  notebook.position.set(-0.44, DESK.TOP_Y + 0.011, 0.86);
  notebook.rotation.y = 0.22;
  const band = slab(0.014, 0.235, 0.024, 0.004, accentGlow);
  band.position.set(-0.4, DESK.TOP_Y + 0.012, 0.86);
  band.rotation.y = 0.22;
  g.add(notebook, band);

  // Cascos apoyados: arco + dos almohadillas, silueta inconfundible.
  const cans = new THREE.Group();
  // Las almohadillas descansan sobre la mesa (centro a la altura de su radio)
  // y el arco arranca justo de ellas.
  const headband = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.013, 10, 28, Math.PI), steel);
  headband.position.set(0, 0.036, 0);
  cans.add(headband);
  for (const sx of [-1, 1]) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.034, 0.032, 20), upholstery);
    cup.rotation.z = Math.PI / 2;
    cup.position.set(sx * 0.078, 0.036, 0);
    cans.add(cup);
  }
  cans.position.set(0.52, DESK.TOP_Y, 0.62);
  cans.rotation.y = -0.5;
  g.add(cans);

  g.add(top, deskLeg(-1, -1), deskLeg(1, -1), deskLeg(-1, 1), deskLeg(1, 1), crossbar, led);

  // Luz de contra, detrás y al lado que da a cámara. Sobre un fondo negro y
  // con la única luz frontal siendo la pantalla, la silla se fundía con el
  // vacío: esto le dibuja el canto y separa la silueta del fondo, que es de
  // lo que más depende que un render se lea como volumen y no como recorte.
  // Intensidad deliberadamente baja: tiene que insinuar el canto, no iluminar.
  // A 2.4 teñía el respaldo entero de azul y se comía la tapicería.
  const rim = new THREE.PointLight(0x93a0ff, 0.9, 2.4, 2);
  rim.position.set(-0.68, 1.2, -0.85);
  g.add(rim);

  // Sin sombras a propósito: el plano de suelo de la escena está en y = -1.02,
  // un metro por debajo de los pies, así que cualquier sombra proyectada cae
  // despegada del mueble. Mejor ninguna que una flotando.
  g.traverse((o) => {
    o.castShadow = false;
    o.receiveShadow = false;
  });

  applyPropEnvironment(g, renderer, 0.5);
  return g;
}
