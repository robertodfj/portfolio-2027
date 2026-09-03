import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/** Cada etapa del narrativo scroll mapea a uno de estos estados. */
export type CharacterState =
  | 'Idle'
  | 'Walking'
  | 'Typing'
  | 'Looking'
  | 'Standing'
  | 'Motorcycle';

/**
 * Una capa de animación activa en un instante dado del timeline.
 *
 * `phase` es lo que convierte esto en un sistema scrubbed: cuando se indica,
 * el clip NO avanza con el tiempo — su cabezal de lectura se coloca donde
 * diga el timeline (y por tanto el scroll). Cuando se omite, el clip corre
 * libre con el reloj real, que es lo que queremos para el idle en reposo.
 */
export interface AnimationLayer {
  state: CharacterState;
  /** Peso de mezcla [0,1]. La suma de las capas debería dar 1. */
  weight: number;
  /** Cabezal normalizado [0,1). Omitir => el clip corre con tiempo real. */
  phase?: number;
}

/**
 * Superficie común que implementan tanto el personaje real (GLB) como el
 * placeholder procedural, para que AnimationService se escriba una sola vez
 * y nunca tenga que saber cuál está activo.
 */
export interface CharacterController {
  readonly root: THREE.Group;
  readonly usingPlaceholder: boolean;
  /** Estados para los que existe realmente un clip utilizable. */
  readonly availableStates: ReadonlySet<CharacterState>;
  /** Fija pesos y cabezales de todas las capas. Idempotente por frame. */
  applyLayers(layers: readonly AnimationLayer[]): void;
  update(delta: number, elapsed: number): void;
  dispose(): void;
}

const CLIP_ALIASES: Record<CharacterState, string[]> = {
  Idle: ['idle', 'breathing', 'stand_idle'],
  Walking: ['walk', 'walking', 'run'],
  Typing: ['typ', 'keyboard', 'work'],
  Looking: ['look', 'turn', 'greet'],
  Standing: ['standing', 'stand', 'pose', 'presentation'],
  Motorcycle: ['motor', 'bike', 'ride'],
};

/**
 * Clips cuyo desplazamiento horizontal debe anularse. La posición en X la
 * decide el scroll; si el clip además trae root motion, ambos se pelean y el
 * personaje se desincroniza del timeline.
 */
const IN_PLACE_STATES: readonly CharacterState[] = ['Walking'];

@Injectable({ providedIn: 'root' })
export class ModelLoaderService {
  private readonly loader = new GLTFLoader();

  constructor() {
    // Soporte Draco opcional para pipelines comprimidos — no-op seguro si el
    // GLB no está comprimido con Draco.
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    this.loader.setDRACOLoader(draco);
  }

  /**
   * Carga /assets/models/roberto.glb. Si el fichero falta, no parsea, O tarda
   * demasiado (p. ej. el decodificador Draco del CDN se atasca), resuelve con
   * un placeholder procedural en vez de colgarse para siempre.
   */
  async loadCharacter(path = 'assets/models/roberto.glb'): Promise<CharacterController> {
    console.info(`[ModelLoaderService] Cargando "${path}"…`);
    try {
      const gltf = await this.withTimeout(this.loader.loadAsync(path), 15000);
      console.info(
        `[ModelLoaderService] GLB cargado. Animaciones detectadas: ${gltf.animations.map((a) => a.name).join(', ') || '(ninguna)'}`,
      );
      return new GltfCharacter(gltf);
    } catch (err) {
      console.warn(
        `[ModelLoaderService] No se pudo cargar "${path}" (o tardó demasiado). Usando personaje placeholder.`,
        err,
      );
      return new PlaceholderCharacter();
    }
  }

  /**
   * Carga un GLB de atrezo (sin animaciones ni rig). Devuelve null en vez de
   * lanzar: un prop que no llega debe degradar la escena, nunca romperla.
   */
  async loadProp(path: string, timeoutMs = 20000): Promise<THREE.Group | null> {
    try {
      const gltf = await this.withTimeout(this.loader.loadAsync(path), timeoutMs);
      return gltf.scene;
    } catch (err) {
      console.warn(`[ModelLoaderService] No se pudo cargar el prop "${path}".`, err);
      return null;
    }
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout tras ${ms}ms (¿decodificador Draco colgado?)`)), ms);
      promise.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        },
      );
    });
  }
}

const wrap01 = (v: number): number => {
  const m = v % 1;
  return m < 0 ? m + 1 : m;
};

/**
 * Corrección de escala/pivote compartida por cualquier humanoide que entre en
 * la escena (el personaje que camina y, ahora, el jinete de la moto). Mide la
 * bounding box en bind pose y la ajusta a `targetHeight` unidades, centrada en
 * X/Z, con los pies en y = -(targetHeight / 2).
 *
 * Extraída de GltfCharacter.normalize() para que motorcycle-rider.ts reutilice
 * exactamente la misma convención (mismo origen, misma escala por altura) sin
 * duplicar la fórmula — cualquier humanoide normalizado con esta función cae
 * en el mismo sistema de coordenadas, condición necesaria para que las
 * constantes de asiento/manillar/estriberas en narrative.config.ts (medidas
 * una vez, a mano, sobre este mismo convenio) sigan siendo válidas.
 */
export function normalizeHumanoid(inner: THREE.Object3D, targetHeight = 2): void {
  let box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());

  if (size.y > 0.0001) {
    const scale = targetHeight / size.y;
    inner.scale.setScalar(scale);
    box = new THREE.Box3().setFromObject(inner);
  }

  const center = box.getCenter(new THREE.Vector3());
  inner.position.x -= center.x;
  inner.position.z -= center.z;
  inner.position.y -= box.min.y + targetHeight / 2;
}

/**
 * Camino real GLB: grafo de escena + AnimationMixer + búsqueda de clips.
 *
 * Las AnimationAction se crean UNA sola vez (perezosamente, cacheadas) y se
 * dejan en `play()` de por vida. Por frame solo se tocan dos números por
 * capa —`weight` y `time`—, nunca se recrean mixer ni acciones.
 */
class GltfCharacter implements CharacterController {
  readonly root: THREE.Group;
  readonly usingPlaceholder = false;

  private mixer: THREE.AnimationMixer;
  private clips = new Map<CharacterState, THREE.AnimationClip>();
  private actions = new Map<CharacterState, THREE.AnimationAction>();
  private states: ReadonlySet<CharacterState> = new Set();

  constructor(gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) {
    // `root` es un envoltorio vacío que AnimationService mueve cada frame
    // (posición/rotación derivadas del scroll). La escena importada vive un
    // nivel dentro, para poder hornear en ella la corrección de escala/offset
    // sin que esa corrección se sobrescriba en cada frame.
    this.root = new THREE.Group();
    const inner = gltf.scene;
    this.root.add(inner);

    inner.traverse((obj: THREE.Object3D) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    this.normalize(inner);

    this.mixer = new THREE.AnimationMixer(this.root);
    this.mapClips(gltf.animations);
    this.states = new Set(this.clips.keys());
  }

  get availableStates(): ReadonlySet<CharacterState> {
    return this.states;
  }

  /**
   * Distintas herramientas (Mixamo, Meshy, Hi3D, un export manual de
   * Blender...) exportan cada una a su escala y su pivote. En vez de confiar
   * en que todo modelo futuro venga a escala humana con los pies en y = 0, lo
   * medimos una vez desde su bounding box en bind pose y lo corregimos para
   * que siempre aterrice donde la cámara del narrativo espera.
   */
  private normalize(inner: THREE.Object3D): void {
    // Siempre se ajusta a targetHeight — sin zona muerta. Una tolerancia
    // "ya está bastante cerca, sáltatelo" suena prudente pero deja pasar en
    // silencio imports mal escalados.
    const before = new THREE.Box3().setFromObject(inner).getSize(new THREE.Vector3());
    normalizeHumanoid(inner);
    console.info(
      `[ModelLoaderService] Modelo normalizado — altura original: ${before.y.toFixed(2)}u, escala aplicada: ${inner.scale.x.toFixed(3)}x.`,
    );
  }

  private mapClips(clips: THREE.AnimationClip[]): void {
    for (const [state, aliases] of Object.entries(CLIP_ALIASES) as [CharacterState, string[]][]) {
      const match = clips.find((c) => aliases.some((a) => c.name.toLowerCase().includes(a)));
      if (match) this.clips.set(state, match);
    }
    // Fallback: si nada casó por nombre, usar los clips que haya, en orden.
    if (this.clips.size === 0 && clips.length) {
      (Object.keys(CLIP_ALIASES) as CharacterState[]).forEach((state, i) => {
        if (clips[i]) this.clips.set(state, clips[i]);
      });
    }

    for (const state of IN_PLACE_STATES) {
      const clip = this.clips.get(state);
      if (clip) this.clips.set(state, stripHorizontalRootMotion(clip));
    }
  }

  /** Crea la acción la primera vez y la deja viva para siempre. */
  private action(state: CharacterState): THREE.AnimationAction | null {
    const cached = this.actions.get(state);
    if (cached) return cached;

    const clip = this.clips.get(state);
    if (!clip) return null;

    const action = this.mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.enabled = true;
    action.weight = 0;
    action.play();
    this.actions.set(state, action);
    return action;
  }

  applyLayers(layers: readonly AnimationLayer[]): void {
    // Todo a cero primero: así una capa que desaparece del array no se queda
    // colgada aportando peso residual.
    for (const action of this.actions.values()) action.weight = 0;

    for (const layer of layers) {
      const action = this.action(layer.state);
      if (!action) continue;

      action.enabled = true;
      action.weight = layer.weight;

      if (layer.phase === undefined) {
        // Corre libre: el mixer lo avanza con el delta real.
        action.timeScale = 1;
      } else {
        // Scrubbed: timeScale 0 congela el avance interno del mixer, de modo
        // que `time` es exclusivamente lo que escribimos aquí. Reproducir
        // hacia atrás es simplemente escribir un `time` menor.
        action.timeScale = 0;
        action.time = wrap01(layer.phase) * action.getClip().duration;
      }
    }
  }

  update(delta: number): void {
    this.mixer.update(delta);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.actions.clear();
  }
}

/**
 * Devuelve una copia del clip sin traslación horizontal en la cadera.
 * La X la manda el scroll; el clip solo debe aportar la zancada y el rebote
 * vertical. Sin esto, un Walking con root motion arrastra al personaje por su
 * cuenta y rompe la sincronía con el timeline.
 */
function stripHorizontalRootMotion(clip: THREE.AnimationClip): THREE.AnimationClip {
  const out = clip.clone();
  let stripped = false;

  for (const track of out.tracks) {
    const dot = track.name.lastIndexOf('.');
    if (dot < 0) continue;
    const node = track.name.slice(0, dot);
    const property = track.name.slice(dot + 1);
    if (property !== 'position' || !/hips?$/i.test(node)) continue;

    const values = track.values;
    const x0 = values[0];
    const z0 = values[2];
    for (let i = 0; i < values.length; i += 3) {
      values[i] = x0; // X congelada
      values[i + 2] = z0; // Z congelada — la vertical (i + 1) se respeta
    }
    stripped = true;
  }

  if (stripped) {
    console.info(`[ModelLoaderService] Root motion horizontal anulado en el clip "${clip.name}".`);
  }
  return out;
}

/**
 * Stand-in procedural low-poly para poder revisar la experiencia antes de que
 * exista el GLB definitivo. Implementa exactamente la misma API applyLayers()/
 * update(), incluida la fase scrubbed, así que el comportamiento frente al
 * scroll es idéntico al del modelo real.
 */
class PlaceholderCharacter implements CharacterController {
  readonly root = new THREE.Group();
  readonly usingPlaceholder = true;
  readonly availableStates: ReadonlySet<CharacterState> = new Set<CharacterState>([
    'Idle',
    'Walking',
    'Typing',
    'Looking',
    'Standing',
    'Motorcycle',
  ]);

  private head!: THREE.Mesh;
  private torso!: THREE.Mesh;
  private armL!: THREE.Group;
  private armR!: THREE.Group;
  private legL!: THREE.Group;
  private legR!: THREE.Group;

  /** Capa dominante, para los estados aún no cubiertos por el timeline. */
  private dominant: CharacterState = 'Idle';
  private walkWeight = 0;
  private walkPhase = 0;

  constructor() {
    this.build();
  }

  private build(): void {
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a1a1f, roughness: 0.55, metalness: 0.25 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x6e7bff, roughness: 0.35, metalness: 0.4 });

    this.torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.55, 4, 12), mat);
    this.torso.position.y = 1.05;
    this.torso.castShadow = true;

    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 20), mat);
    this.head.position.y = 1.62;
    this.head.castShadow = true;

    const visor = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 8, 24), accentMat);
    visor.position.set(0, 1.6, 0.17);
    visor.rotation.x = Math.PI / 2;

    this.armL = this.buildLimb(0.09, 0.5, mat, accentMat);
    this.armL.position.set(-0.34, 1.32, 0);
    this.armR = this.buildLimb(0.09, 0.5, mat, accentMat);
    this.armR.position.set(0.34, 1.32, 0);

    this.legL = this.buildLimb(0.11, 0.62, mat, accentMat);
    this.legL.position.set(-0.14, 0.62, 0);
    this.legR = this.buildLimb(0.11, 0.62, mat, accentMat);
    this.legR.position.set(0.14, 0.62, 0);

    this.root.add(this.torso, this.head, visor, this.armL, this.armR, this.legL, this.legR);
    this.root.traverse((o: THREE.Object3D) => (o.castShadow = true));
  }

  private buildLimb(radius: number, length: number, mat: THREE.Material, tipMat: THREE.Material): THREE.Group {
    const g = new THREE.Group();
    const bone = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 8), mat);
    bone.position.y = -length / 2 - radius;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.9, 12, 12), tipMat);
    tip.position.y = -length - radius * 2;
    g.add(bone, tip);
    return g;
  }

  applyLayers(layers: readonly AnimationLayer[]): void {
    this.walkWeight = 0;
    let best = -1;
    for (const layer of layers) {
      if (layer.state === 'Walking') {
        this.walkWeight = layer.weight;
        this.walkPhase = layer.phase ?? this.walkPhase;
      }
      if (layer.weight > best) {
        best = layer.weight;
        this.dominant = layer.state;
      }
    }
  }

  update(_delta: number, elapsed: number): void {
    // Fase 1: mezcla explícita Idle <-> Walking, con el ciclo de zancada
    // gobernado por la fase que llega del scroll (nunca por `elapsed`).
    if (this.dominant === 'Idle' || this.dominant === 'Walking') {
      this.blendIdleWalk(elapsed);
      return;
    }

    // Estados aún no cubiertos por el timeline: bucles procedurales simples.
    switch (this.dominant) {
      case 'Typing':
        this.armL.rotation.x = -1.15 + Math.sin(elapsed * 14) * 0.05;
        this.armR.rotation.x = -1.15 + Math.cos(elapsed * 14) * 0.05;
        this.head.rotation.x = 0.25;
        this.resetLegs();
        break;
      case 'Looking':
        this.head.rotation.y = Math.sin(elapsed * 1.4) * 0.35;
        this.resetLimbs();
        break;
      case 'Motorcycle':
        this.armL.rotation.x = -0.9;
        this.armR.rotation.x = -0.9;
        this.legL.rotation.x = -0.6;
        this.legR.rotation.x = -0.6;
        this.torso.rotation.x = 0.15;
        break;
      case 'Standing':
      default:
        this.resetLimbs();
        this.torso.rotation.z = Math.sin(elapsed * 0.5) * 0.02;
        break;
    }
  }

  private blendIdleWalk(elapsed: number): void {
    const w = this.walkWeight;
    const swing = Math.sin(this.walkPhase * Math.PI * 2);

    // Pose de caminar (scrubbed) mezclada con la de reposo (tiempo real).
    this.armL.rotation.x = swing * 0.6 * w;
    this.armR.rotation.x = -swing * 0.6 * w;
    this.legL.rotation.x = -swing * 0.6 * w;
    this.legR.rotation.x = swing * 0.6 * w;

    this.head.rotation.x = 0;
    this.torso.rotation.x = 0;
    this.torso.rotation.z = 0;

    const walkBob = Math.abs(swing) * 0.03;
    const idleBreath = Math.sin(elapsed * 1.6) * 0.01;
    this.torso.position.y = 1.05 + THREE.MathUtils.lerp(idleBreath, walkBob, w);
    this.head.rotation.y = Math.sin(elapsed * 0.6) * 0.08 * (1 - w);
  }

  private resetLimbs(): void {
    this.armL.rotation.x = 0;
    this.armR.rotation.x = 0;
    this.head.rotation.x = 0;
    this.torso.rotation.x = 0;
    this.resetLegs();
  }

  private resetLegs(): void {
    this.legL.rotation.x = 0;
    this.legR.rotation.x = 0;
  }

  dispose(): void {
    this.root.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m: THREE.Material) => m.dispose());
      }
    });
  }
}
