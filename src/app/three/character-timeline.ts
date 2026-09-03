import * as THREE from 'three';
import { CAMERA, WALK } from './narrative.config';

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

export interface TimelineSample {
  progress: number;
  /** 0 = Idle puro, 1 = Walking puro. */
  walkBlend: number;
  /** Cabezal de lectura normalizado del clip Walking, [0,1). */
  walkPhase: number;
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
export function evaluateTimeline(progress: number, out: TimelineSample): TimelineSample {
  const p = clamp01(progress);
  out.progress = p;

  // --- 1. Recorrido normalizado de la fase 1 -------------------------------
  // Lineal a propósito: cualquier easing aquí rompería la relación 1:1 entre
  // "cuánto he hecho scroll" y "cuánto ha avanzado el personaje".
  const travel = clamp01((p - WALK.START_PROGRESS) / (WALK.END_PROGRESS - WALK.START_PROGRESS));

  // --- 2. Posición del personaje ------------------------------------------
  const x = THREE.MathUtils.lerp(WALK.WALK_START_X, WALK.WALK_END_X, travel);
  out.position.set(x, WALK.BASE_Y, WALK.BASE_Z);

  // --- 3. Mezcla Idle <-> Walking -----------------------------------------
  // Sube al empezar a haber scroll real y baja al agotarse el recorrido.
  const fadeIn = smoothstep(WALK.START_PROGRESS, WALK.START_PROGRESS + WALK.BLEND_IN, p);
  const fadeOut = 1 - smoothstep(WALK.END_PROGRESS - WALK.BLEND_OUT, WALK.END_PROGRESS, p);
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
 * Presencia [0,1] de un elemento ligado a una sección del DOM: entra al
 * empezar su tramo, se mantiene, y sale al terminarlo. Igual de pura y de
 * reversible que el timeline del personaje — el mismo `progress` da siempre
 * el mismo valor, así que al subir se deshace exactamente igual.
 *
 * @param fade fracción del tramo dedicada a entrar y a salir.
 */
export function sectionPresence(
  progress: number,
  range: { start: number; end: number },
  fade: number,
): number {
  const span = range.end - range.start;
  if (span <= 0) return 0;

  const margin = span * clamp01(fade);
  const rampIn = smoothstep(range.start, range.start + margin, progress);
  const rampOut = 1 - smoothstep(range.end - margin, range.end, progress);
  return rampIn * rampOut;
}
