import * as THREE from 'three';

/**
 * ÚNICA fuente de números del narrativo scroll-driven.
 * Nada de valores mágicos repartidos por los servicios: si algo se ajusta,
 * se ajusta aquí.
 */

/** ---------------------------------------------------------------------
 *  1. SCROLL
 *  ------------------------------------------------------------------ */
export const SCROLL = {
  /**
   * Suavizado del scroll, por frame a 60fps (0 = 1:1 absolutamente crudo).
   * Es un acercamiento exponencial al valor real: NO adelanta al scroll,
   * NO rebota y NO acumula deltas — solo absorbe el escalón discreto de la
   * rueda / trackpad para que el timeline no tiemble. Ponlo a 0 si quieres
   * acoplamiento literal frame a frame.
   */
  SMOOTHING: 0.18,

  /**
   * Por debajo de esta diferencia el valor suavizado salta al real. Garantiza
   * que al soltar el scroll el personaje se detiene EXACTAMENTE en el punto
   * del timeline y no sigue reptando durante medio segundo.
   */
  SNAP_EPSILON: 0.00005,
} as const;

/** ---------------------------------------------------------------------
 *  2. FASE 1 — IDLE -> CAMINAR HACIA LA IZQUIERDA
 *  ------------------------------------------------------------------ */
export const WALK = {
  /** Tramo de scroll que ocupa la fase 1. */
  START_PROGRESS: 0.0,
  END_PROGRESS: 0.30,

  /** Posición X en START_PROGRESS. */
  WALK_START_X: 0,
  /** Posición X en END_PROGRESS. Negativo = izquierda de la pantalla. */
  WALK_END_X: -2.9,

  /** El personaje no cambia de plano en la fase 1. */
  BASE_Y: 0,
  BASE_Z: 0.4,

  /**
   * Unidades de mundo que cubre UNA vuelta completa del clip Walking.
   * Es la constante que elimina el patinaje de pies: si los pies resbalan
   * hacia adelante, bájala; si el personaje "corre en el sitio", súbela.
   *
   * 1.664 es la zancada REAL del clip, medida por cinemática directa: la
   * separación máxima entre mixamorigLeftFoot y mixamorigRightFoot da un paso
   * de 0.832 u con el modelo normalizado a 2 unidades de alto, y el ciclo son
   * dos pasos. A ese valor exacto el patinaje de pies es cero.
   *
   * 1.50 baja deliberadamente un 10% por debajo para que la cadencia se vea
   * más viva; ese 10% es todo el patinaje que hay. Súbelo a 1.664 si prefieres
   * pisada perfecta. El grueso de la velocidad extra viene de WALK_END_X, que
   * cubre más terreno por scroll sin introducir patinaje alguno.
   */
  CYCLE_DISTANCE: 1.5,

  /** Tramo de scroll (en unidades de progress) del fundido Idle -> Walking. */
  BLEND_IN: 0.015,
  /**
   * Tramo del fundido Walking -> Idle al final del recorrido, para que la
   * fase 1 termine de pie y no congelada a media zancada.
   * Ponlo a 0 cuando exista la fase 2 y el caminar deba encadenar.
   */
  BLEND_OUT: 0.04,

  /** Orientación en radianes. 0 = de frente a cámara; -PI/2 = mirando a -X. */
  IDLE_ROT_Y: 0,
  WALK_ROT_Y: -Math.PI / 2,
  /**
   * Tramo de scroll del giro de 90°. Deliberadamente más largo que BLEND_IN:
   * el cuerpo entra en el ciclo de zancada enseguida, pero girarse lleva algo
   * más de recorrido, que es como se lee un giro real y no un snap.
   */
  TURN_IN: 0.035,
} as const;

/** ---------------------------------------------------------------------
 *  3. CÁMARA
 *  ------------------------------------------------------------------ */
export const CAMERA = {
  POSITION: new THREE.Vector3(0, 1.35, 5.2),
  LOOK_AT: new THREE.Vector3(0, 1.0, 0.4),
  /**
   * Cuánto acompaña la cámara al personaje. 0 = fija, 1 = pegada.
   * Subido de 0.25 a 0.32 al alargar WALK_END_X: con el recorrido nuevo,
   * a 0.25 el personaje terminaba pegado al borde izquierdo del encuadre.
   */
  FOLLOW: 0.32,

  /**
   * Semiancho de mundo que el encuadre debe cubrir SIEMPRE, medido desde el
   * punto al que mira la cámara. Cubre al personaje al final de su recorrido
   * (|WALK_END_X| * (1 - FOLLOW) ≈ 1.97, más su propio ancho) y a la moto en
   * su posición. Si el aspecto de la ventana no da para tanto, la cámara se
   * aleja lo justo: sin esto, en 4:3 o en móvil el personaje se sale del
   * cuadro al terminar de caminar.
   */
  REQUIRED_HALF_WIDTH: 2.7,

  /**
   * Tope de alejamiento. En vertical extremo (9:16) cumplir el semiancho
   * exigiría 3x de distancia y el personaje quedaría diminuto; se prefiere
   * recortar un poco los bordes a perderlo de vista.
   */
  MAX_DISTANCE_SCALE: 2.2,
} as const;

/** ---------------------------------------------------------------------
 *  4. MOTO — pieza de la sección "Más allá del código"
 *  ------------------------------------------------------------------ */
export const MOTORBIKE = {
  PATH: 'assets/models/motorbike.glb',

  /**
   * Sección cuyo paso por pantalla decide cuándo está presente. El tramo se
   * mide del DOM en cada refresh, así que reordenar secciones o cambiar sus
   * alturas no obliga a tocar ningún número aquí.
   */
  SECTION_SELECTOR: '#about',

  /** Colocación en mundo. El personaje termina la fase 1 sobre x = WALK_END_X. */
  POSITION: new THREE.Vector3(1.2, 0.75, -1.0),

  /**
   * Alto en unidades de mundo. El GLB trae su propia escala de export, así
   * que se normaliza igual que el personaje en vez de confiar en ella.
   */
  TARGET_HEIGHT: 1.0,

  /** Giro continuo sobre su eje Y, en radianes por segundo. */
  SPIN_SPEED: 0.45,

  /** Inclinación fija, para que no se lea como un perfil plano al girar. */
  TILT_X: 0.1,
  TILT_Z: -0.06,

  /** Fracción del tramo de sección dedicada a entrar y a salir. */
  FADE: 0.18,

  /** Intensidad del env map propio (no se toca el resto de la escena). */
  ENV_INTENSITY: 0.9,

  /** 300k vértices: proyectar sombra duplicaría el coste de la pasada. */
  CAST_SHADOW: false,
} as const;

/** ---------------------------------------------------------------------
 *  5. AMBIENTE
 *  ------------------------------------------------------------------ */
export const AMBIENT = {
  PARTICLES_DESKTOP: 140,
  PARTICLES_MOBILE: 60,
  /** Radianes por segundo del campo de partículas (independiente del scroll). */
  PARTICLE_SPIN: (Math.PI * 2) / 240,
} as const;
