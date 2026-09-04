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
  REQUIRED_HALF_WIDTH: 2.6,

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
   * ella. El personaje mide 2, así que 2.66 la deja claramente por encima de
   * él — que es la intención: en su sección la moto manda.
   *
   * AQUÍ es donde se controla el tamaño de la moto (a petición explícita,
   * bajado un 5% desde 2.8). Todo lo que cuelga de RIDER (SEAT, GRIP_L/R,
   * PEG_L/R) está medido en ESTE mismo sistema de coordenadas — son
   * distancias en el espacio ya normalizado por este valor, no posiciones
   * fijas en el mundo. Si este número vuelve a tocarse, esas cuatro
   * constantes tienen que reescalarse en la misma proporción (multiplicar
   * cada componente por el mismo factor), o dejan de apuntar a los puntos
   * reales del manillar/asiento/estriberas. Además de encoger la silueta de
   * la moto, esto relaja notablemente el brazo del jinete: al escalar TODO
   * el sistema de coordenadas de la moto (asiento, manillar Y las
   * proporciones entre ellos) mientras el personaje se mantiene a su tamaño
   * real, el hueco que el brazo tiene que cubrir se hace proporcionalmente
   * más pequeño frente a un brazo que no cambia de longitud — verificado
   * contra el esqueleto real: el codo pasa de 171° (a un paso de bloquearse)
   * a 140° (bastante más relajado), con mano y pie exactos en los dos casos.
   */
  TARGET_HEIGHT: 2.35,

  /**
   * Escala del conjunto YA MONTADO (moto + jinete juntos), aplicada sobre
   * `root` — el grupo que envuelve a los dos. A propósito NO se toca
   * TARGET_HEIGHT para esto: ese normaliza solo el GLB de la moto, y todo lo
   * de RIDER (SEAT, GRIP_L/R, PEG_L/R) está anclado a ESE sistema de
   * coordenadas — cambiar TARGET_HEIGHT obligaría a reescalar los cuatro a
   * mano otra vez. Escalando `root` en cambio, moto y jinete crecen juntos
   * de forma rígida sin mover ni un milímetro la pose ya ajustada.
   *
   * 1.1 = +10%, a petición explícita. setPresence() y setPlacement() ya
   * cuentan con este factor (ver ambas).
   */
  SCENE_SCALE: 1.1,

  /** Giro continuo sobre su eje Y, en radianes por segundo. */
  SPIN_SPEED: 0.45,

  /**
   * Interactividad con el ratón — la ÚNICA parte de toda la moto que
   * reacciona al puntero en vez de al scroll/reloj. Ver MotorbikeProp.update:
   * es también el único sitio de esa clase que acumula estado frame a frame
   * (integra una velocidad angular) en lugar de derivarse de un valor
   * absoluto — con velocidad variable no hay forma de calcular el ángulo sin
   * memoria, así que aquí sí toca.
   */
  /** Fracción de SPIN_SPEED mientras el puntero está encima de la moto. */
  HOVER_SPEED_SCALE: 0.3,
  /**
   * Con qué rapidez se acerca la velocidad actual a la deseada (1/s) al
   * entrar o salir del hover. Un acercamiento exponencial, no un salto —
   * mismo patrón que SCROLL.SMOOTHING. Mayor = transición más brusca.
   */
  HOVER_EASE: 4,
  /** Velocidad angular extra (rad/s) que añade cada clic sobre la moto. */
  CLICK_KICK: 5,
  /**
   * Con qué rapidez se disipa el impulso del clic (1/s) — un empujón que
   * decae solo, no un interruptor. Mayor = frena antes.
   */
  KICK_FRICTION: 1.2,

  /**
   * Inclinación fija del conjunto moto+jinete (ambos cuelgan del mismo
   * `root`, así que giran juntos con esto — no hace falta tocar nada de
   * RIDER). TILT_X es balanceo lateral (banking, para que no se lea como un
   * perfil plano al girar) — se queda. TILT_Z era cabeceo hacia delante
   * (bajaba el morro ~0.084u y subía la cola otro tanto): a petición
   * explícita, a 0 para que quede horizontal.
   */
  TILT_X: 0.1,
  TILT_Z: 0,

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

  /**
   * La SALIDA ahora se ancla a la SIGUIENTE sección (a petición explícita:
   * "que desaparezca 2 scrolls antes de llegar al texto de 'En qué he estado
   * trabajando'", el título de #experience) — ya no al propio tramo de
   * "Más allá del código".
   */
  EXIT_SECTION_SELECTOR: '#experience',

  /**
   * "2 scrolls" traducido a una distancia fija en vh: un "scroll" no tiene
   * una magnitud real (varía muchísimo entre rueda de ratón, trackpad y
   * sistema operativo), así que se aproxima a un par de gestos de scroll
   * normales. Es el número a tocar si al verlo desaparece demasiado pronto o
   * demasiado tarde respecto al título.
   */
  EXIT_LEAD_VH: 70,

  /** Ancho del fundido de salida, también en vh — mismo motivo que arriba. */
  EXIT_FADE_VH: 10,

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
 *  5. JINETE — Roberto montado en la moto
 *  ------------------------------------------------------------------ */
export const RIDER = {
  /** Misma ruta que el personaje que camina: es el mismo GLB, sin modificar. */
  PATH: 'assets/models/roberto.glb',

  /**
   * Todas las constantes de esta sección están medidas en el sistema de
   * coordenadas que deja `normalizeHumanoid()` sobre la moto YA normalizada
   * (MOTORBIKE.TARGET_HEIGHT = 2.8, ver motorbike-prop.ts) — es decir, en el
   * espacio local de `spin`, donde el jinete se añade como hermano del `inner`
   * de la moto.
   *
   * Se obtuvieron reconstruyendo la jerarquía de nodos de motorbike.glb a
   * mano (posiciones de mundo de BONE_HANDLE/BONE_L_GRIP/BONE_R_GRIP, bbox
   * completo de la moto) y las longitudes de hueso reales de roberto.glb
   * (bind pose, ya normalizado a altura 2), y comprobando numéricamente que
   * la distancia hombro→puño y cadera→estribera cae en un rango de flexión
   * de codo/rodilla natural (ni estirado al máximo ni doblado por completo).
   * Si se reexporta cualquiera de los dos GLB con proporciones distintas,
   * hay que remedir — son válidas para ESTE par de modelos, no una fórmula
   * general.
   *
   * SEAT recalibrado dos veces tras revisar capturas reales:
   *   1) (-0.08, 0.15) no tenía ninguna referencia de asiento en el GLB de
   *      la moto (no existe ese bone) y quedaba prácticamente centrado sobre
   *      el depósito — el jinete aparecía tumbado sobre el carenado.
   *      Se movió hacia atrás y abajo, a (-0.22, 0.0).
   *   2) A petición explícita, subido deliberadamente por ENCIMA de su
   *      altura correcta como punto de partida para afinar a ojo desde ahí
   *      bajándolo — más barato que acertar la altura exacta a la primera
   *      sin poder ver el render.
   *
   *      OJO: el primer intento de subirlo (0.28, con LEAN_DEG=40) se basó
   *      en una estimación simplificada (solo traslaciones, sin las
   *      rotaciones reales de bind de cada hueso) y resultó demasiado
   *      optimista — con el rig REAL el codo ya está bloqueado a 178° (brazo
   *      recto) a partir de ~0.20-0.22 CON ESE LEAN, no cerca de 0.30.
   *
   *      Al pedir subirlo todavía más (0.20 -> 0.35), tocar solo Y volvía a
   *      bloquear el codo (a 0.25 con LEAN_DEG=40 el error de la mano ya era
   *      0.026, y crecía sin parar al seguir subiendo). La salida no es solo
   *      Y: subir el asiento SIN aumentar LEAN_DEG deja el hombro cada vez
   *      más lejos y por encima del puño, y el brazo se queda corto. Subir
   *      LEAN_DEG junto con Y adelanta y agacha el hombro lo suficiente para
   *      que la mano siga llegando exacta. Confirmado con el esqueleto real:
   *      a (SEAT.y=0.35, LEAN_DEG=60) la mano vuelve a error 0.0000 con un
   *      codo estirado pero no bloqueado (~156°).
   *
   *      3) Subido otra vez (0.35 -> 0.40) con el mismo ajuste de LEAN_DEG
   *      (60° -> 66°): error de mano 0.0000, codo ~162° (estirado, no
   *      bloqueado), rodilla ~97° (bastante más relajada que antes).
   *
   *      4) A partir de aquí, subir SOLO Y (manteniendo LEAN≈66-69°) volvía
   *      a bloquear el codo casi de inmediato (a 0.43/69° el error de mano
   *      ya era 0.0009, codo a 178°) — el margen se había agotado. La salida
   *      fue subir LEAN_DEG mucho más agresivamente (66° -> 72°): a
   *      (SEAT.y=0.42, LEAN_DEG=72) la mano vuelve a error 0.0000 con un
   *      codo MÁS relajado que antes (~145°, no más estirado — subir el
   *      lean lo suficiente relaja el codo en vez de forzarlo). Si hace
   *      falta subir aún más, hay que seguir subiendo LEAN_DEG en la misma
   *      proporción; pasado cierto punto el torso empieza a leerse casi
   *      tumbado sobre el depósito (a partir de ~80-85° ya lo está), así que
   *      no conviene forzarlo mucho más sin verlo.
   *
   *      5) A petición explícita: personaje demasiado adelantado — la
   *      entrepierna atravesaba el depósito y las manos quedaban dentro. La
   *      X del asiento (-0.22) seguía cayendo dentro de la zona ancha del
   *      depósito/carena; movida hacia atrás a -0.32. Esto ALEJA la cadera
   *      del depósito directamente (sin depender de ninguna IK), y de paso
   *      alarga la distancia hombro→puño lo suficiente como para que, subiendo
   *      LEAN_DEG a la vez (72° -> 85°), el círculo de posiciones alcanzables
   *      del codo quede orientado de forma más favorable: el codo pasa de
   *      saturar en Z≈-0.26 a Z≈-0.29 (el depósito mide ~±0.28), y además
   *      relajado (131° en vez de 145°) en lugar de más forzado. Mano y pie
   *      exactos (error 0.0000), verificado contra el esqueleto real.
   *
   *      6) Subido y movido hacia atrás una vez más (-0.32,0.42 -> -0.36,0.46)
   *      con LEAN_DEG 85° -> 88°. Sigue exacto (error 0.0000 en manos y
   *      pies), pero el codo vuelve a cerrarse un poco (Z≈-0.23, peor
   *      despeje del depósito que en el paso 5) y a estirarse más (159-161°).
   *
   *      7) A petición explícita ("échale el culo más para atrás", con los
   *      pies ya dados por buenos — PEG_L/R no se tocó): SEAT.x -0.36 -> -0.38
   *      con LEAN_DEG 88° -> 89°. Sigue exacto (error 0.0000), pero el codo
   *      ya está en 171° — a un paso de bloquearse del todo. Comprobado que
   *      -0.40 con LEAN_DEG=89.5° (prácticamente el tope de la fórmula) YA NO
   *      da error 0.0000 (0.0119): la mano empieza a quedarse corta.
   *
   *      LÍMITE DURO, esta vez de verdad: -0.38 es la X más atrasada para la
   *      que la mano todavía llega exacta al puño real. Un "más atrás"
   *      adicional YA NO se puede resolver subiendo LEAN_DEG — no queda
   *      margen (89.5° es, a efectos prácticos, el máximo utilizable; 90°
   *      hace que la fórmula del brazo se indefina). La estribera no se ve
   *      afectada por SEAT.x (PEG_L/R es independiente), así que los pies
   *      siguen intactos pase lo que pase aquí.
   */

  /** Punto de la cadera (Hips) sobre el asiento. */
  SEAT: new THREE.Vector3(-0.361, 0.437, 0),

  /**
   * Puños del manillar. L = lado izquierdo del personaje, R = derecho.
   *
   * IMPORTANTE — RADIO MÁXIMO DE ALCANCE: el hombro está en, aproximadamente,
   * (-0.03, 0.61, ±0.18) [depende un poco de SEAT/LEAN_DEG, se recalcula
   * solo si se tocan]. El brazo (bíceps + antebrazo) mide en total ≈0.5615
   * de aquí a la mano. Cualquier punto que pongas en GRIP_L/R MÁS LEJOS que
   * eso del hombro NO se alcanza de verdad: el codo se bloquea en línea
   * recta (180°) y la mano se queda corta, colgando en la dirección del
   * objetivo pero sin llegar — exactamente lo que pasó con (0.5145, 0.1062,
   * ±0.3501): estaba a 0.756 del hombro, un 35% fuera de alcance.
   *
   * Para comprobarlo tú mismo: distancia_3D(hombro, tu_punto) tiene que ser
   * ≤ ~0.55 (dejando un pelín de margen antes de bloquear del todo).
   *
   * Valores actuales: misma DIRECCIÓN que el intento anterior (más adelante,
   * más arriba y más ancho que el original) pero recortada al radio real —
   * mano exacta (error 0.0000), codo a 126° (cómodo, ni estirado ni
   * bloqueado). Sigue reescalado ×0.95 junto con MOTORBIKE.TARGET_HEIGHT.
   */
  GRIP_L: new THREE.Vector3(0.3311, 0.3863, -0.2937),
  GRIP_R: new THREE.Vector3(0.3304, 0.3863, 0.2935),

  /**
   * Empuje adicional "hacia fuera" del codo (a lo largo de Z, alejándolo del
   * torso), por encima de lo que ya aporta el bind pose. No cambia dónde
   * llega la mano (eso lo fija GRIP_L/R) — solo abre el ángulo del codo.
   * 0 = usar solo la referencia del bind pose, sin empuje extra.
   *
   * OJO — límite real: el pole solo elige EN QUÉ PUNTO del círculo de
   * posiciones alcanzables (fijado por la distancia hombro→puño y las
   * longitudes de brazo/antebrazo) cae el codo; no puede sacarlo de ese
   * círculo — solo SEAT/LEAN_DEG (que cambian el círculo entero) pueden
   * moverlo más allá de lo que este valor ya consigue. Subirlo más allá de
   * ~0.6 no cambia nada más.
   */
  ELBOW_OUT: 0.6,

  /**
   * Estriberas. No existe un bone de estribera en motorbike.glb — se
   * recolocaron cerca de BONE_GEAR (la palanca de cambio, el único punto del
   * rig realmente anclado a la zona de los pies), en vez de la posición
   * original (mucho más atrás y abajo, cerca del basculante) con la que los
   * pies no llegaban a ninguna estribera visible.
   *
   * A petición explícita, movidas otra vez: más atrás (X más negativa, hacia
   * SEAT.x) y más abiertas (mayor |Z|), y además ACERCADAS a la cadera en
   * vertical (Y más alta, más cerca de SEAT.y) — es precisamente ese acercar
   * lo que dobla más la rodilla (rodilla 94° -> 71°, más plegada/"metida"),
   * no la X ni la Z por sí solas: alejar la estribera de la cadera abre la
   * rodilla, acercarla la cierra. Pie exacto (error 0.0000), verificado.
   * Reescaladas ×0.95 junto con MOTORBIKE.TARGET_HEIGHT (ver esa constante).
   */
  PEG_L: new THREE.Vector3(-0.304, -0.0475, -0.240),
  PEG_R: new THREE.Vector3(-0.304, -0.0475, 0.240),

  /**
   * El personaje mira hacia +Z en bind pose (ver WALK.IDLE_ROT_Y). La moto
   * apunta hacia +X (manillar/rueda delantera en X positiva). Girar +90°
   * alrededor de Y lleva el +Z del personaje a +X: el jinete queda mirando
   * exactamente hacia donde apunta la moto.
   */
  YAW_Y: Math.PI / 2,

  /**
   * Inclinación del torso hacia el manillar, en grados, aplicada como
   * rotación LOCAL adicional sobre el hueso Spine alrededor de su propio eje
   * lateral (X). No afecta a Hips (la pelvis se queda nivelada sobre el
   * asiento) ni a las piernas.
   *
   * Ligado a SEAT (X e Y): cuanto más se mueve la cadera — más alto, o más
   * atrás alejándola del depósito — más hay que inclinar el torso para que
   * el hombro llegue a alcanzar el mismo puño real sin que el brazo se
   * quede corto y el codo se bloquee en línea recta. Subido junto con SEAT
   * en cada ronda: 32° -> 40° -> 60° -> 66° -> 72° -> 85° -> 88° -> 89°,
   * verificado cada vez contra el esqueleto real.
   *
   * YA NO QUEDA MARGEN: a 89° el codo está en 171° (a un paso de bloquearse
   * en línea recta) y la mano sigue llegando exacta por muy poco. Probado
   * subir SEAT.x un paso más (-0.38 -> -0.40) incluso con LEAN_DEG=89.5°
   * (prácticamente 90°, el máximo absoluto de la fórmula): la mano YA NO
   * llega exacta (error 0.0119). Si se pide "más atrás" otra vez, este valor
   * no tiene más recorrido — hay que revisar GRIP_L/R o aceptar visiblemente
   * que la mano no toque el puño.
   */
  LEAN_DEG: 89,

  /**
   * Contra-rotación del cuello: un piloto real no deja caer la mirada con el
   * torso, levanta la cabeza para seguir mirando al frente. Se aplica sobre
   * Neck, en sentido contrario a LEAN_DEG y a una fracción de su magnitud
   * (una compensación total dejaría la cabeza antinaturalmente erguida).
   * Mantiene la misma proporción (~0.62×LEAN_DEG) al subir LEAN_DEG.
   */
  NECK_COUNTER_DEG: 55,
} as const;

/** ---------------------------------------------------------------------
 *  6. AMBIENTE
 *  ------------------------------------------------------------------ */
export const AMBIENT = {
  PARTICLES_DESKTOP: 140,
  PARTICLES_MOBILE: 60,
  /** Radianes por segundo del campo de partículas (independiente del scroll). */
  PARTICLE_SPIN: (Math.PI * 2) / 240,
} as const;
