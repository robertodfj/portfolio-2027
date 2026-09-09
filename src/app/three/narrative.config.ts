import * as THREE from 'three';

/**
 * Única fuente de números del narrativo. Si algo hay que ajustar, se ajusta
 * aquí y no repartido por los servicios.
 */

/* ----------------------------------------------------------------- 0. CARGA */
export const LOADING = {
  /**
   * Tope total de la pantalla de carga, contado desde que arranca la escena.
   *
   * Se espera a tener TODOS los GLB montados y los shaders compilados antes de
   * descubrir la escena, porque descubrirla a medias se ve peor que esperar:
   * la moto apareciendo de la nada y el tirón de compilar el primer frame.
   * Pero la espera nunca puede ser abierta, así que al agotarse este tope se
   * descubre con lo que haya. Lo que falte llega después, que es exactamente
   * lo que pasaba antes de forma permanente.
   *
   * 12 s da de sobra para los ~7.7 MB de GLB en una conexión normal y corta en
   * seco las patológicas.
   */
  MAX_MS: 12000,

  /** Mínimo en pantalla: por debajo de esto es un parpadeo, no una carga. */
  MIN_MS: 600,

  /** Fundido de salida. Debe coincidir con la transición del componente. */
  FADE_MS: 600,
} as const;

/* ------------------------------------------------------------------ 1. SCROLL */
export const SCROLL = {
  /**
   * Suavizado por frame a 60fps (0 = acoplamiento crudo). Es un acercamiento
   * exponencial: no adelanta al scroll ni rebota, solo absorbe el escalón de
   * la rueda para que el timeline no tiemble.
   */
  SMOOTHING: 0.18,

  /** Por debajo de esta diferencia salta al valor real, para parar en seco. */
  SNAP_EPSILON: 0.00005,
} as const;

/* ---------------------------------------- 2. FASE 1: IDLE -> CAMINAR Y SALIR */
export const WALK = {
  START_PROGRESS: 0.0,

  /**
   * El final se ancla a cuándo "Más allá del código" ocupa la pantalla, no a
   * un progress fijo: hero y about miden 100vh, así que un número fijo dejaría
   * al personaje a medio salir si cambian de alto. 0.85 = sale al 85 % del
   * camino hasta ese punto.
   */
  EXIT_LEAD: 0.85,

  /** Solo mientras la sección aún no se ha podido medir. */
  END_PROGRESS_FALLBACK: 0.18,

  WALK_START_X: 0,

  /**
   * Unidades más allá del borde visible hasta las que camina. El destino real
   * se calcula del semiancho del encuadre: una X fija no puede garantizar
   * "fuera de pantalla" en 21:9 y en 4:3 a la vez.
   */
  EXIT_MARGIN: 1.0,

  /** Para saber cuándo ha salido ENTERO, no solo su centro. */
  CHARACTER_HALF_WIDTH: 0.45,

  BASE_Y: 0,
  BASE_Z: 0.4,

  /**
   * Unidades que cubre una vuelta completa del clip Walking. Es la constante
   * que quita el patinaje de pies: si resbalan hacia delante, bájala; si corre
   * en el sitio, súbela.
   *
   * 1.664 es la zancada real medida sobre el clip (0.832 u por paso con el
   * modelo normalizado a 2 de alto, dos pasos por ciclo). A ese valor el
   * patinaje es cero, así que cada 1 % por debajo es 1 % de patinaje.
   */
  CYCLE_DISTANCE: 1.664,

  /** Tramo de scroll del fundido Idle -> Walking. */
  BLEND_IN: 0.015,

  /** 0 = no vuelve a Idle: termina fuera de cuadro, caminando. */
  BLEND_OUT: 0,

  /** Radianes. 0 = de frente a cámara; -PI/2 = mirando a -X. */
  IDLE_ROT_Y: 0,
  WALK_ROT_Y: -Math.PI / 2,

  /** Más largo que BLEND_IN: girarse lleva más recorrido que arrancar a andar. */
  TURN_IN: 0.035,
} as const;

/* ------------------------------------------------------------------ 3. CÁMARA */
export const CAMERA = {
  POSITION: new THREE.Vector3(0, 1.35, 5.2),
  LOOK_AT: new THREE.Vector3(0, 1.0, 0.4),

  /** Cuánto acompaña al personaje. Alto lo perseguiría y nunca saldría de cuadro. */
  FOLLOW: 0.12,

  /**
   * Semiancho de mundo que el encuadre debe cubrir siempre. Lo que garantiza
   * es que la moto quepa entera; si el aspecto no da, la cámara se aleja.
   */
  REQUIRED_HALF_WIDTH: 2.6,

  /** Tope de alejamiento: en 9:16 cumplirlo dejaría al personaje diminuto. */
  MAX_DISTANCE_SCALE: 2.2,
} as const;

/* -------------------------------------------------------------------- 4. MOTO */
export const MOTORBIKE = {
  PATH: 'assets/models/motorbike.glb',

  /** Sección a la que se ancla su entrada. */
  SECTION_SELECTOR: '#about',

  /** Posición horizontal como fracción del semiancho visible: el hueco a la derecha del texto. */
  SCREEN_X: 0.42,

  /** Altura y profundidad sí en mundo: no dependen del ancho de la ventana. */
  WORLD_Y: 0.9,
  WORLD_Z: -1.0,

  /** Dimensión mayor tras normalizar el GLB. */
  TARGET_HEIGHT: 2.35,
  SCENE_SCALE: 1.1,

  /**
   * Giro, en radianes por segundo. La moto está prácticamente quieta y es el
   * ratón el que la hace girar: así el giro es una respuesta a lo que hace el
   * usuario y no un carrusel que da vueltas solo.
   */
  IDLE_SPIN_SPEED: 0.05,
  HOVER_SPIN_SPEED: 1.1,

  /** Rapidez con la que arranca y frena al entrar y salir el puntero. */
  HOVER_EASE: 2.6,

  /** Inclinación fija para que no se lea como un plano de catálogo. */
  TILT_X: 0.1,
  TILT_Z: 0,

  /** Entrada, en fracciones del tramo de caminata. */
  ENTER_DELAY: 0.02,
  ENTER_FADE: 0.1,

  /**
   * La salida cuelga de la SIGUIENTE sección, no de la suya: así no queda
   * rastro de la moto cuando se llega al título de experiencia.
   */
  EXIT_SECTION_SELECTOR: '#experience',
  /** En vh para que no dependa de cuánto mida la página. */
  EXIT_LEAD_VH: 70,
  EXIT_FADE_VH: 10,

  /** Intensidad de su env map propio (no toca el resto de la escena). */
  ENV_INTENSITY: 0.9,

  /** Margen contra el borde del cuadro en ventanas estrechas. */
  FRAME_PADDING: 0.1,

  /** 300k vértices: proyectar sombra duplicaría el coste de la pasada. */
  CAST_SHADOW: false,
} as const;

/* ------------------------------------------------------------------ 5. JINETE */
/**
 * Coordenadas del jinete sobre la moto, en el espacio local de la moto ya
 * normalizada. Están medidas a mano una sola vez: si cambias TARGET_HEIGHT o
 * la normalización de humanoides, hay que volver a medirlas todas.
 */
export const RIDER = {
  /** Mismo GLB que el personaje que camina, sin modificar. */
  PATH: 'assets/models/roberto.glb',

  /** Punto de la cadera (Hips) sobre el asiento. */
  SEAT: new THREE.Vector3(-0.361, 0.437, 0),

  /** Puños del manillar: destino de la IK de los brazos. */
  GRIP_L: new THREE.Vector3(0.3311, 0.3863, -0.2937),
  GRIP_R: new THREE.Vector3(0.3304, 0.3863, 0.2935),

  /**
   * Cuánto se abre el codo hacia fuera. El pole parte del CODO y no del
   * hombro: applyTwoBoneIK resta la posición de la raíz, así que partiendo del
   * hombro este desplazamiento se cancelaría y el valor no haría nada.
   */
  ELBOW_OUT: 0.6,

  /** Estriberas: destino de la IK de las piernas. */
  PEG_L: new THREE.Vector3(-0.304, -0.0475, -0.240),
  PEG_R: new THREE.Vector3(-0.304, -0.0475, 0.240),

  /** Giro para alinearlo con el eje de la moto. */
  YAW_Y: Math.PI / 2,

  /** Inclinación del torso hacia el manillar, en grados. */
  LEAN_DEG: 89,

  /** Contra-rotación del cuello para que mire al frente pese al torso inclinado. */
  NECK_COUNTER_DEG: 55,
} as const;

/* ----------------------------------------------------------------- 6. AMBIENTE */
export const AMBIENT = {
  PARTICLES_DESKTOP: 900,
  PARTICLES_MOBILE: 600,
  /** Radianes por segundo del campo de partículas (independiente del scroll). */
  PARTICLE_SPIN: (Math.PI * 2) / 240,
} as const;

/* -------------------------------------------- 7. FASE 2: LLEGAR A LA MESA */
export const DESK = {
  /** Sección cuyo `top` ancla el inicio de la caminata hacia la mesa. */
  SECTION_SELECTOR: '#experience',
  /** Anclas 2ª y 3ª de la ruta de cámara. */
  TECH_SECTION_SELECTOR: '#technologies',
  CONTACT_SECTION_SELECTOR: '#contact',

  /** Cuánto ANTES de #experience arranca, y cuánto dura, en vh. */
  ENTER_LEAD_VH: 65,
  ENTER_SPAN_VH: 90,

  /** Fuera de cuadro por la izquierda, para que la entrada no se vea aparecer. */
  WALK_START: new THREE.Vector3(-4.6, WALK.BASE_Y, -0.1),

  /** Asiento. Sobre este mismo punto se monta el mueble entero. */
  SEAT: new THREE.Vector3(2.3, WALK.BASE_Y, -0.1),

  /** Orientación mientras camina y ya sentado. */
  ENTER_ROT_Y: Math.PI / 2,
  SEAT_ROT_Y: 0.55,

  /** Fracción final del recorrido en la que se gira hacia la mesa. */
  TURN_WINDOW: 0.35,

  /** Fracción final que se dedica a sentarse en el sitio, sin desplazarse. */
  SIT_BLEND: 0.22,

  /** Cuánto tarda la cámara en relevar a la de la fase 1. */
  CAMERA_BLEND: 0.9,

  /** Escala propia de esta fase; el salto ocurre fuera de cuadro. */
  SCENE_SCALE: 1.3,

  /** Ancla 1: plano de llegada, ya sentado. */
  CAMERA_POSITION: new THREE.Vector3(1.55, 1.75, 4.25),
  CAMERA_LOOK_AT: new THREE.Vector3(1.85, 1.45, 0.2),

  /**
   * Ancla 2: se aleja y sube para que quepan mesa, silla y personaje mientras
   * se leen las tecnologías.
   *
   * Sobre la pantalla del portátil: el panel mira hacia él, así que desde aquí
   * se percibe como luz y no como texto legible. Para un primer plano en el
   * que SÍ se lea el código, cambiar por (medido sobre la pantalla con
   * TECH_YAW aplicado; deja fuera de cuadro la mesa y la silla):
   *
   *   TECH_CAMERA_POSITION: new THREE.Vector3(2.519, 1.535, -0.762)
   *   TECH_CAMERA_LOOK_AT:  new THREE.Vector3(3.108, 1.135, 0.490)
   */
  TECH_CAMERA_POSITION: new THREE.Vector3(1.75, 2.4, 6.3),
  TECH_CAMERA_LOOK_AT: new THREE.Vector3(2.3, 2.3, 0.2),

  /** Ancla 3: vuelve a acercarse para cerrar en contacto. */
  CONTACT_CAMERA_POSITION: new THREE.Vector3(1.6, 1.65, 4.5),
  CONTACT_CAMERA_LOOK_AT: new THREE.Vector3(1.8, 1.2, 0.15),

  /** Giro del conjunto (personaje + mueble) en cada ancla. */
  TECH_YAW: -0.18,
  CONTACT_YAW: 0.26,

  /** En móvil el texto ocupa todo el ancho: la escena se corre para no taparlo. */
  MOBILE_CAMERA_SHIFT_X: -0.26,
} as const;
