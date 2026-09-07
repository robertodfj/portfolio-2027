import * as THREE from 'three';
import { CAMERA, DESK, MOTORBIKE, WALK } from './narrative.config';
import { SectionRange } from './scroll-progress.service';

/**
 * Timeline: todas las funciones puras de scrollProgress.
 *
 *   progress ──> walkBlend (mezcla Idle/Walking)
 *           ──> walkPhase (fotograma del clip)
 *           ──> position / rotationY / cámara
 *
 * Sin estado interno ni acumuladores: el mismo progress da siempre el mismo
 * resultado. De ahí sale que subir el scroll deshaga el recorrido exacto — no
 * es una animación de vuelta, es la misma función evaluada al revés.
 */

/**
 * Lo único que el timeline no puede saber por sí mismo: depende del layout
 * real y del tamaño de la ventana. Se mide fuera y se inyecta, para que la
 * función siga siendo pura y determinista dado un contexto.
 */
export interface TimelineContext {
  /** Progreso al que "Más allá del código" pasa a ocupar la pantalla. */
  aboutTop: number;
  /** Semiancho de mundo visible en el plano del personaje. */
  visibleHalfWidth: number;
}

export interface TimelineSample {
  progress: number;
  /** 0 = Idle puro, 1 = Walking puro. */
  walkBlend: number;
  /** Cabezal de lectura normalizado del clip Walking, [0,1). */
  walkPhase: number;
  /** Progreso al que termina el tramo de caminata. Unidad de referencia del narrativo. */
  walkEndProgress: number;
  /** Progreso al que el personaje ha salido ENTERO del cuadro. */
  exitProgress: number;
  position: THREE.Vector3;
  rotationY: number;
  cameraPosition: THREE.Vector3;
  cameraLookAt: THREE.Vector3;
}

/** Contenedor reutilizable: cero asignaciones por frame. */
export function createTimelineSample(): TimelineSample {
  return {
    progress: 0,
    walkBlend: 0,
    walkPhase: 0,
    walkEndProgress: 0,
    exitProgress: 0,
    position: new THREE.Vector3(),
    rotationY: 0,
    cameraPosition: new THREE.Vector3(),
    cameraLookAt: new THREE.Vector3(),
  };
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Hermite suave: derivada 0 en ambos extremos -> nada de popping al entrar/salir. */
const smoothstep = (edge0: number, edge1: number, x: number): number => {
  if (edge1 <= edge0) return x < edge0 ? 0 : 1;
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** Módulo siempre positivo, para que el scrub hacia atrás no produzca fase negativa. */
const wrap01 = (v: number): number => {
  const m = v % 1;
  return m < 0 ? m + 1 : m;
};

/**
 * Evalúa el timeline completo para un `progress` dado y escribe el resultado
 * en `out`. Determinista y sin efectos secundarios.
 */
export function evaluateTimeline(
  progress: number,
  ctx: TimelineContext,
  out: TimelineSample,
): TimelineSample {
  const p = clamp01(progress);
  out.progress = p;

  // --- 0. Final del recorrido, derivado del layout y del encuadre ----------
  // El personaje debe estar fuera antes de que se lea "Más allá del código".
  const endProgress = ctx.aboutTop > 0 ? ctx.aboutTop * WALK.EXIT_LEAD : WALK.END_PROGRESS_FALLBACK;

  // La cámara le sigue un FOLLOW del camino, así que para que la distancia
  // RELATIVA supere el borde hay que dividir por (1 - FOLLOW).
  const exitX = -(ctx.visibleHalfWidth + WALK.EXIT_MARGIN) / (1 - CAMERA.FOLLOW);

  // Instante en que su borde derecho cruza el borde izquierdo del cuadro. La
  // distancia RELATIVA a la cámara recorre (halfWidth + EXIT_MARGIN) en todo
  // el tramo, y hace falta (halfWidth + su propio semiancho) para desaparecer.
  const goneAt = (ctx.visibleHalfWidth + WALK.CHARACTER_HALF_WIDTH) /
    (ctx.visibleHalfWidth + WALK.EXIT_MARGIN);
  out.walkEndProgress = endProgress;
  out.exitProgress = endProgress * Math.min(goneAt, 1);

  // --- 1. Recorrido normalizado de la fase 1 -------------------------------
  // Lineal a propósito: cualquier easing aquí rompería la relación 1:1 entre
  // "cuánto he hecho scroll" y "cuánto ha avanzado el personaje".
  const span = endProgress - WALK.START_PROGRESS;
  const travel = span > 0 ? clamp01((p - WALK.START_PROGRESS) / span) : 0;

  // --- 2. Posición del personaje ------------------------------------------
  const x = THREE.MathUtils.lerp(WALK.WALK_START_X, exitX, travel);
  out.position.set(x, WALK.BASE_Y, WALK.BASE_Z);

  // --- 3. Mezcla Idle <-> Walking -----------------------------------------
  // Sube al empezar a haber scroll real. BLEND_OUT a 0 significa que ya no
  // vuelve a Idle: termina fuera de cuadro, caminando.
  const fadeIn = smoothstep(WALK.START_PROGRESS, WALK.START_PROGRESS + WALK.BLEND_IN, p);
  const fadeOut = WALK.BLEND_OUT > 0 ? 1 - smoothstep(endProgress - WALK.BLEND_OUT, endProgress, p) : 1;
  out.walkBlend = fadeIn * fadeOut;

  // --- 4. Fotograma del clip Walking --------------------------------------
  // Derivado de la DISTANCIA recorrida, no del tiempo: los pies quedan
  // clavados al desplazamiento y el ciclo se invierte solo al subir.
  const distance = Math.abs(x - WALK.WALK_START_X);
  out.walkPhase = wrap01(distance / WALK.CYCLE_DISTANCE);

  // --- 5. Orientación ------------------------------------------------------
  // Rampa propia, más larga que la del blend: el giro necesita más recorrido
  // que la entrada en el ciclo de zancada para no leerse como un snap. Sigue
  // siendo función pura de `p`, así que el giro se deshace solo al subir.
  const turn = smoothstep(WALK.START_PROGRESS, WALK.START_PROGRESS + WALK.TURN_IN, p) * fadeOut;
  out.rotationY = THREE.MathUtils.lerp(WALK.IDLE_ROT_Y, WALK.WALK_ROT_Y, turn);

  // --- 6. Cámara -----------------------------------------------------------
  const followX = (x - WALK.WALK_START_X) * CAMERA.FOLLOW;
  out.cameraPosition.set(CAMERA.POSITION.x + followX, CAMERA.POSITION.y, CAMERA.POSITION.z);
  out.cameraLookAt.set(CAMERA.LOOK_AT.x + followX, CAMERA.LOOK_AT.y, CAMERA.LOOK_AT.z);

  return out;
}

/**
 * Presencia [0,1] de la moto. Los dos extremos cuelgan de cosas distintas a
 * propósito: la ENTRADA del personaje (arranca en cuanto sale de cuadro, para
 * no dejar hueco muerto) y la SALIDA de la sección SIGUIENTE, para que no
 * quede rastro cuando se llega al título de experiencia.
 *
 * Tan pura y reversible como el resto del timeline.
 */
export function motorbikePresence(
  progress: number,
  sample: TimelineSample,
  nextSectionRange: SectionRange,
  exitLeadProgress: number,
  exitFadeProgress: number,
): number {
  // Unidad de referencia: el tramo de caminata (≈85vh, anclado al layout).
  const unit = sample.walkEndProgress;
  const start = sample.exitProgress + unit * MOTORBIKE.ENTER_DELAY;
  const rampIn = smoothstep(start, start + unit * MOTORBIKE.ENTER_FADE, progress);

  // Sección aún sin medir (antes del primer refresh de ScrollTrigger): no
  // recortar la salida con un `top` en 0, que la escondería de inmediato.
  if (nextSectionRange.top <= 0) return rampIn;

  const exitAt = nextSectionRange.top - exitLeadProgress;
  const rampOut = 1 - smoothstep(exitAt - exitFadeProgress, exitAt, progress);
  return rampIn * rampOut;
}

/**
 * Lo que la fase "escritorio" no puede saber por sí misma: los anclajes de
 * layout de las tres secciones de las que cuelga (dónde arranca la caminata,
 * y dónde giran cámara/personaje después). `techTop`/`contactTop` llegan a 0
 * mientras esa sección no se haya podido medir todavía — igual que
 * `SectionRange.top` en el resto del archivo.
 */
export interface DeskContext {
  /** `top` de #experience: ancla el fin de la caminata (ENTER_LEAD_VH antes). */
  sectionTop: number;
  /** DESK.ENTER_LEAD_VH / ENTER_SPAN_VH ya convertidos a `progress` (ver ScrollProgressService.vhToProgress). */
  enterLeadProgress: number;
  enterSpanProgress: number;
  /** `top` de #technologies y #contact — anclas 2ª y 3ª de la ruta de cámara. */
  techTop: number;
  contactTop: number;
}

export interface DeskSample {
  /** false hasta que arranca la caminata hacia la mesa; a partir de ahí, para siempre. */
  active: boolean;
  /** Escala del personaje en esta fase (DESK.SCENE_SCALE, fija mientras `active`). */
  scale: number;
  position: THREE.Vector3;
  rotationY: number;
  /** Giro del CONJUNTO (personaje + mueble) sobre SEAT_ROT_Y, por sección. */
  setupYaw: number;
  /** Peso de Walking mientras llega (1 -> 0 en el tramo SIT_BLEND final). */
  walkBlend: number;
  walkPhase: number;
  /** Peso de Typing (1 - walkBlend, ya sentado se queda fijo a 1). */
  typingBlend: number;
  /** Fracción del fragmento de código ya escrito en la pantalla, [0,1]. */
  typingProgress: number;
  cameraPosition: THREE.Vector3;
  cameraLookAt: THREE.Vector3;
}

export function createDeskSample(): DeskSample {
  return {
    active: false,
    scale: 1,
    position: new THREE.Vector3(),
    rotationY: 0,
    setupYaw: 0,
    walkBlend: 0,
    walkPhase: 0,
    typingBlend: 0,
    typingProgress: 0,
    cameraPosition: new THREE.Vector3(),
    cameraLookAt: new THREE.Vector3(),
  };
}

/** Vectores de trabajo para evaluateDesk — cero asignaciones por frame. */
const deskCamPos = new THREE.Vector3();
const deskCamLook = new THREE.Vector3();

/**
 * Interpola la cámara ORBITANDO alrededor de `center` en vez de en línea
 * recta. Entre dos anclas situadas a lados opuestos del escritorio, una
 * interpolación lineal mete la cámara por dentro del personaje y del mueble;
 * girando el ángulo y la distancia por separado, el trayecto rodea la escena.
 */
function orbitLerp(
  from: THREE.Vector3,
  to: THREE.Vector3,
  center: THREE.Vector3,
  t: number,
  out: THREE.Vector3,
): void {
  const fromAngle = Math.atan2(from.z - center.z, from.x - center.x);
  const toAngle = Math.atan2(to.z - center.z, to.x - center.x);

  // Siempre por el camino corto: sin esto una diferencia de 200° daría la
  // vuelta larga y la cámara cruzaría media escena de más.
  let delta = toAngle - fromAngle;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;

  const angle = fromAngle + delta * t;
  const radius = THREE.MathUtils.lerp(
    Math.hypot(from.x - center.x, from.z - center.z),
    Math.hypot(to.x - center.x, to.z - center.z),
    t,
  );

  out.set(
    center.x + Math.cos(angle) * radius,
    THREE.MathUtils.lerp(from.y, to.y, t),
    center.z + Math.sin(angle) * radius,
  );
}

/**
 * Fase escritorio: caminar hasta la silla, sentarse (fundido Walking->Typing)
 * y una ruta de cámara de tres anclas (llegada, tecnologías, contacto). Tan
 * pura y reversible como evaluateTimeline.
 *
 * `fromCamera*` es la cámara de la fase 1 en ese mismo frame: el punto de
 * partida del relevo, para que no dé un salto.
 */
export function evaluateDesk(
  progress: number,
  ctx: DeskContext,
  fromCameraPosition: THREE.Vector3,
  fromCameraLookAt: THREE.Vector3,
  out: DeskSample,
): DeskSample {
  const start = ctx.sectionTop - ctx.enterLeadProgress;
  out.active = ctx.sectionTop > 0 && progress >= start;
  if (!out.active) return out;

  out.scale = DESK.SCENE_SCALE;

  // --- 1. Recorrido normalizado de la caminata hacia la silla --------------
  const span = ctx.enterSpanProgress;
  const travel = span > 0 ? clamp01((progress - start) / span) : 1;
  const arrivalProgress = start + span;

  // --- 2. Posición ---------------------------------------------------------
  // El desplazamiento se agota ANTES que la ventana: la fracción SIT_BLEND
  // final se dedica a sentarse EN EL SITIO. Y llega frenando (ease-out), que
  // además acorta las zancadas al final por sí solo — el ciclo del clip sale
  // de la distancia recorrida, así que sigue sin patinar ni un milímetro.
  const walkT = DESK.SIT_BLEND < 1 ? clamp01(travel / (1 - DESK.SIT_BLEND)) : travel;
  const approach = 1 - (1 - walkT) * (1 - walkT);
  out.position.lerpVectors(DESK.WALK_START, DESK.SEAT, approach);

  // --- 3. Fotograma del clip Walking, misma unidad que la fase 1 ----------
  const distance = Math.abs(out.position.x - DESK.WALK_START.x);
  out.walkPhase = wrap01(distance / WALK.CYCLE_DISTANCE);

  // --- 4. Fundido Walking -> Typing, ya parado delante de la silla --------
  const sitBlend = smoothstep(1 - DESK.SIT_BLEND, 1, travel);
  out.walkBlend = 1 - sitBlend;
  out.typingBlend = sitBlend;

  // El código termina de escribirse justo al llegar a contacto, para que el
  // scroll del tramo sentado tenga algo que ir revelando.
  const typingEnd = ctx.contactTop > arrivalProgress ? ctx.contactTop : arrivalProgress + span;
  out.typingProgress = clamp01((progress - arrivalProgress) / (typingEnd - arrivalProgress));

  // --- 5. Ruta de 3 anclas (llegada -> tecnologías -> contacto): cámara y
  //        giro del conjunto. Se evalúa siempre; el giro solo se aplica una
  //        vez sentado, y antes de la llegada vale 0 de forma natural
  //        (smoothstep por debajo de su borde inferior).
  deskCamPos.copy(DESK.CAMERA_POSITION);
  deskCamLook.copy(DESK.CAMERA_LOOK_AT);
  let yaw = 0;

  if (ctx.techTop > arrivalProgress) {
    const t1 = smoothstep(arrivalProgress, ctx.techTop, progress);
    orbitLerp(DESK.CAMERA_POSITION, DESK.TECH_CAMERA_POSITION, DESK.SEAT, t1, deskCamPos);
    deskCamLook.lerpVectors(DESK.CAMERA_LOOK_AT, DESK.TECH_CAMERA_LOOK_AT, t1);
    yaw = THREE.MathUtils.lerp(0, DESK.TECH_YAW, t1);

    if (ctx.contactTop > ctx.techTop) {
      const t2 = smoothstep(ctx.techTop, ctx.contactTop, progress);
      orbitLerp(deskCamPos.clone(), DESK.CONTACT_CAMERA_POSITION, DESK.SEAT, t2, deskCamPos);
      deskCamLook.lerp(DESK.CONTACT_CAMERA_LOOK_AT, t2);
      yaw = THREE.MathUtils.lerp(yaw, DESK.CONTACT_YAW, t2);
    }
  }
  out.setupYaw = yaw;

  // --- 6. Orientación del personaje: gira hacia la mesa en los últimos pasos
  //        y, ya sentado, acompaña al giro del conjunto (mueble incluido).
  const turnFactor = smoothstep(1 - DESK.TURN_WINDOW, 1, walkT);
  out.rotationY = THREE.MathUtils.lerp(DESK.ENTER_ROT_Y, DESK.SEAT_ROT_Y + yaw, turnFactor);

  // --- 7. Cámara: releva a la de la fase 1 durante la caminata, se instala
  //        del todo en la ruta de anclas en cuanto se sienta. -------------
  if (travel < 1) {
    const camBlend = smoothstep(0, DESK.CAMERA_BLEND, travel);
    out.cameraPosition.lerpVectors(fromCameraPosition, DESK.CAMERA_POSITION, camBlend);
    out.cameraLookAt.lerpVectors(fromCameraLookAt, DESK.CAMERA_LOOK_AT, camBlend);
  } else {
    out.cameraPosition.copy(deskCamPos);
    out.cameraLookAt.copy(deskCamLook);
  }

  return out;
}
