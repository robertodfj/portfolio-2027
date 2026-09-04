import * as THREE from 'three';
import { CAMERA, MOTORBIKE, WALK } from './narrative.config';
import { SectionRange } from './scroll-progress.service';

/**
 * TIMELINE — todas las funciones PURAS de scrollProgress viven aquí.
 *
 *   scrollProgress ──> walkBlend   (mezcla Idle/Walking)
 *                 ──> walkPhase    (fotograma del clip Walking, [0,1))
 *                 ──> position     (X derivada del scroll)
 *                 ──> rotationY
 *                 ──> cámara
 *
 * No hay estado interno, ni tiempo transcurrido, ni acumuladores: el mismo
 * `progress` produce SIEMPRE exactamente el mismo resultado. De ahí sale la
 * reversibilidad perfecta al hacer scroll hacia arriba — no es una animación
 * "de vuelta", es literalmente la misma función evaluada al revés.
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
 * Presencia [0,1] de la moto, con los dos extremos anclados a cosas distintas
 * a propósito:
 *
 *   ENTRADA -> al personaje. Arranca en cuanto termina de salir del cuadro,
 *              así no queda hueco muerto entre que él se va y ella llega.
 *   SALIDA  -> a la SIGUIENTE sección (#experience): desaparece
 *              EXIT_LEAD_VH antes de que su título entre en pantalla, no
 *              cuando "Más allá del código" se va — así ya no queda ni rastro
 *              de la moto para cuando el usuario llega al título siguiente.
 *
 * Igual de pura y reversible que el timeline del personaje: el mismo
 * `progress` da siempre el mismo valor, así que al subir se deshace idéntico.
 *
 * `exitLeadProgress`/`exitFadeProgress` llegan ya convertidos de vh a
 * progress (ver ScrollProgressService.vhToProgress) — igual que
 * TimelineContext, es lo único que esta función no puede saber por sí misma.
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
