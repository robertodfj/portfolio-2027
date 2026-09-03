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
  /** Inicio de la fase 1. */
  START_PROGRESS: 0.0,

  /**
   * El final NO es un número fijo: se ancla a cuándo "Más allá del código"
   * pasa a ocupar la pantalla, para que el personaje ya esté fuera de cuadro
   * antes de que el usuario lea esa sección. 0.85 = completa su salida al 85%
   * del camino hasta ese punto.
   *
   * Se ancla y no se hardcodea porque hero y about miden 100vh cada uno: si
   * mañana cambian de alto, un 0.30 fijo dejaría al personaje a medio salir.
   */
  EXIT_LEAD: 0.85,

  /** Usado solo mientras la sección aún no se ha podido medir. */
  END_PROGRESS_FALLBACK: 0.18,

  /** Posición X en START_PROGRESS. */
  WALK_START_X: 0,

  /**
   * Unidades de mundo MÁS ALLÁ del borde visible hasta las que camina. El
   * destino exacto se calcula del semiancho real del encuadre (que depende
   * del aspecto de la ventana), no de una X fija: una constante no puede
   * garantizar "fuera de pantalla" en 21:9 y en 4:3 a la vez.
   */
  EXIT_MARGIN: 1.0,

  /**
   * Semiancho del personaje. Sirve para saber cuándo ha salido del cuadro
   * ENTERO (y no solo su centro), que es el instante al que se engancha la
   * aparición de la moto.
   */
  CHARACTER_HALF_WIDTH: 0.45,

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
   * Se deja en el valor real: al salir de pantalla el personaje ya cubre
   * mucho más terreno en mucho menos scroll, así que la cadencia sube sola
   * ~2.6x respecto al ajuste anterior. Añadirle encima un recorte artificial
   * solo metería patinaje sin hacerlo parecer más rápido. Bájalo si aun así
   * quieres las piernas más nerviosas; cada 1% por debajo es 1% de patinaje.
   */
  CYCLE_DISTANCE: 1.664,

  /** Tramo de scroll (en unidades de progress) del fundido Idle -> Walking. */
  BLEND_IN: 0.015,
  /**
   * 0 = no vuelve a Idle al final. Ahora el personaje termina FUERA de cuadro,
   * así que pararlo de pie no se vería y solo restaría continuidad al volver
   * a subir. La fase 2 decidirá con qué encadena cuando reaparezca.
   */
  BLEND_OUT: 0,

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
   * Bajado a 0.12 ahora que el personaje debe SALIRSE: un seguimiento alto
   * lo perseguiría y nunca llegaría a irse del cuadro. Queda lo justo para
   * que la cámara respire durante la caminata.
   */
  FOLLOW: 0.12,

  /**
   * Semiancho de mundo que el encuadre debe cubrir SIEMPRE, medido desde el
   * punto al que mira la cámara. Ya no encuadra al personaje al final (ahora
   * su trabajo es irse); lo que garantiza es que la MOTO quepa entera en su
   * sección. Si el aspecto de la ventana no da para tanto, la cámara se aleja
   * lo justo — y ese alejamiento alarga a su vez el recorrido de salida del
   * personaje, que se calcula del semiancho real.
   */
  REQUIRED_HALF_WIDTH: 2.5,

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

  /**
   * Posición horizontal EN PANTALLA, normalizada: 0 = centro, 1 = borde
   * derecho. Se ancla en pantalla y no en X de mundo porque el hueco a rellenar
   * lo define la maqueta (el texto va topado a 34ch y la parrilla a 520px, así
   * que el espacio libre arranca sobre el 42% del ancho). Un valor en unidades
   * de mundo se descolocaría en cuanto cambiase el aspecto o la cámara se
   * alejase; este cae siempre en el mismo sitio del encuadre.
   */
  SCREEN_X: 0.42,

  /** Altura y profundidad sí en mundo: no dependen del ancho de la ventana. */
  WORLD_Y: 0.9,
  WORLD_Z: -1.0,

  /**
   * Dimensión mayor en unidades de mundo. El GLB trae su propia escala de
   * export, así que se normaliza igual que el personaje en vez de confiar en
   * ella. El personaje mide 2, así que 1.4 la deja a ~2/3 de su altura.
   */
  TARGET_HEIGHT: 1.4,

  /** Giro continuo sobre su eje Y, en radianes por segundo. */
  SPIN_SPEED: 0.45,

  /** Inclinación fija, para que no se lea como un perfil plano al girar. */
  TILT_X: 0.1,
  TILT_Z: -0.06,

  /**
   * La ENTRADA se ancla al instante exacto en que el personaje termina de
   * salir del cuadro, no a la sección: así aparece justo al esconderse él,
   * sin el hueco muerto que dejaba anclarla al tramo de "Más allá del código".
   *
   * Ambos valores van en fracciones del tramo de caminata (≈85vh de scroll),
   * que es una unidad estable porque también está anclada al layout.
   */
  ENTER_DELAY: 0.02,
  ENTER_FADE: 0.1,

  /** La SALIDA sí se ancla a la sección: se va cuando la sección se va. */
  EXIT_AT: 0.85,
  EXIT_FADE: 0.15,

  /** Intensidad del env map propio (no se toca el resto de la escena). */
  ENV_INTENSITY: 0.9,

  /**
   * Holgura mínima entre la moto y el borde del cuadro. En ventanas estrechas
   * la cámara no puede alejarse más (MAX_DISTANCE_SCALE), así que en vez de
   * dejar que se recorte se la acerca al centro lo justo.
   */
  FRAME_PADDING: 0.1,

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
