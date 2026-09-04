import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MOTORBIKE } from './narrative.config';

/**
 * La moto de la sección "Más allá del código".
 *
 * Dos ejes bien separados:
 *   - PRESENCIA  -> la manda el scroll (entra y sale con la sección).
 *   - GIRO       -> lo manda el reloj (gira siempre), modulado por el ratón:
 *                   más lento con el puntero encima, con un impulso extra en
 *                   cada clic. Es la única parte de la clase que reacciona al
 *                   ratón — el resto sigue siendo scroll puro.
 *
 * Jerarquía interna:
 *   root     posición/escala en mundo, la presencia escala aquí
 *    └ spin  rotación continua sobre el eje Y
 *       ├ inner  el GLB, desplazado para que su centro caiga en el origen
 *       │        del pivote — sin esto la moto orbitaría en vez de girar.
 *       └ rider  (opcional) Roberto montado — hermano de `inner` en el MISMO
 *                espacio local, así que hereda automáticamente el giro, la
 *                presencia y la inclinación de la moto sin código adicional.
 */
export class MotorbikeProp {
  readonly root = new THREE.Group();
  private readonly spin = new THREE.Group();
  /** El GLB de la moto en sí — contra esto se lanza el rayo del hover/clic. */
  private readonly hitTarget: THREE.Group;
  private readonly raycaster = new THREE.Raycaster();
  private environment?: THREE.Texture;
  private presence = 0;

  /** Ángulo acumulado del giro — ver comentario en update(). */
  private spinAngle = 0;
  /** Fracción actual de SPIN_SPEED, suavizada hacia 1 o hacia HOVER_SPEED_SCALE. */
  private speedScale = 1;
  /** Velocidad angular extra (rad/s) que deja un clic, decayendo con fricción. */
  private kickVelocity = 0;
  private hovered = false;

  constructor(inner: THREE.Group, renderer: THREE.WebGLRenderer) {
    this.hitTarget = inner;
    this.root.add(this.spin);
    this.spin.add(inner);

    this.normalize(inner);
    this.applyEnvironment(inner, renderer);

    inner.traverse((obj: THREE.Object3D) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = MOTORBIKE.CAST_SHADOW;
        obj.receiveShadow = false;
      }
    });

    // La X la fija setPlacement cada frame, en coordenadas de pantalla.
    this.root.position.set(0, MOTORBIKE.WORLD_Y, MOTORBIKE.WORLD_Z);
    this.root.rotation.x = MOTORBIKE.TILT_X;
    this.root.rotation.z = MOTORBIKE.TILT_Z;

    this.setPresence(0);
  }

  /**
   * Cuelga al jinete (ya posado, ver motorcycle-rider.ts) como hermano de
   * `inner` dentro de `spin`. A partir de aquí, moto y jinete son UNA sola
   * unidad para el resto de esta clase: setPresence/update/dispose no
   * necesitan saber que el jinete existe, porque vive en el mismo espacio
   * local y hereda su transform.
   */
  attachRider(rider: THREE.Group): void {
    this.spin.add(rider);
  }

  /**
   * El GLB viene a la escala del export. Se mide una vez y se corrige para
   * que ocupe TARGET_HEIGHT, igual que se hace con el personaje, y se recentra
   * sobre el pivote de giro.
   */
  private normalize(inner: THREE.Object3D): void {
    let box = new THREE.Box3().setFromObject(inner);
    const size = box.getSize(new THREE.Vector3());
    const largest = Math.max(size.x, size.y, size.z);

    if (largest > 0.0001) {
      inner.scale.setScalar(MOTORBIKE.TARGET_HEIGHT / largest);
      box = new THREE.Box3().setFromObject(inner);
    }

    const center = box.getCenter(new THREE.Vector3());
    inner.position.sub(center);

    console.info(
      `[MotorbikeProp] Moto normalizada — dimensión mayor original: ${largest.toFixed(3)}u, escala: ${inner.scale.x.toFixed(4)}x.`,
    );
  }

  /**
   * La moto trae materiales PBR con clearcoat y specular, que sin nada que
   * reflejar se ven planos y apagados. Se le genera un env map propio y se
   * asigna material a material: la iluminación del resto de la escena (y por
   * tanto el aspecto del personaje) queda intacta.
   */
  private applyEnvironment(inner: THREE.Object3D, renderer: THREE.WebGLRenderer): void {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04).texture;
    pmrem.dispose();
    room.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });

    inner.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        const standard = material as THREE.MeshStandardMaterial;
        if (!('envMap' in standard)) continue;
        standard.envMap = this.environment ?? null;
        standard.envMapIntensity = MOTORBIKE.ENV_INTENSITY;
        standard.needsUpdate = true;
      }
    });
  }

  /**
   * Presencia en escena, [0,1], derivada del scroll. A 0 se saca del render
   * por completo: son 300k vértices, no basta con escalarlos a cero.
   */
  setPresence(t: number): void {
    this.presence = t;
    this.root.visible = t > 0.001;
    this.root.scale.setScalar(t * MOTORBIKE.SCENE_SCALE);
  }

  /**
   * Coloca la moto en SCREEN_X del encuadre actual — el hueco a la derecha del
   * texto — y la mete hacia dentro si el cuadro no da para mostrarla entera
   * (ventanas estrechas, donde la cámara ya no puede alejarse más).
   */
  setPlacement(cameraX: number, visibleHalfWidth: number): void {
    // Con SCENE_SCALE el conjunto ocupa más que TARGET_HEIGHT en pantalla —
    // si este cálculo no lo supiera, en ventanas estrechas el 10% extra
    // podría salirse del borde sin que FRAME_PADDING lo detectase.
    const half = (MOTORBIKE.TARGET_HEIGHT * MOTORBIKE.SCENE_SCALE) / 2;
    const maxOffset = Math.max(0, visibleHalfWidth - half - MOTORBIKE.FRAME_PADDING);
    const desired = MOTORBIKE.SCREEN_X * visibleHalfWidth;
    this.root.position.x = cameraX + THREE.MathUtils.clamp(desired, -maxOffset, maxOffset);
  }

  /**
   * Lanza el rayo del puntero contra la moto y actualiza si está encima.
   * Se le pasan matrices YA actualizadas a este frame — llamarlo antes de
   * eso apuntaría un frame por detrás de dónde está la moto de verdad.
   * Devuelve el propio resultado para que quien llama no tenga que guardar
   * el estado por su cuenta.
   */
  updatePointer(ndc: THREE.Vector2, camera: THREE.Camera): boolean {
    if (this.presence <= 0.001) {
      this.hovered = false;
      return false;
    }
    this.raycaster.setFromCamera(ndc, camera);
    this.hovered = this.raycaster.intersectObject(this.hitTarget, true).length > 0;
    return this.hovered;
  }

  /** Añade impulso de giro. Varios clics seguidos se suman (con fricción). */
  kick(): void {
    this.kickVelocity += MOTORBIKE.CLICK_KICK;
  }

  /**
   * Giro. Solo corre mientras la moto está en escena.
   *
   * Único sitio de esta clase donde se acumula estado frame a frame en vez
   * de derivarse de un valor absoluto: antes de que la velocidad pudiera
   * cambiar por hover/clic, `rotation.y = elapsed * SPIN_SPEED` bastaba (una
   * función pura del reloj). En cuanto la velocidad varía con la
   * interacción, ya no hay ningún "elapsed" único del que recalcular el
   * ángulo sin memoria — es, literalmente, un volante físico: hay que
   * integrar la velocidad para saber dónde ha quedado.
   */
  update(delta: number): void {
    if (this.presence <= 0.001) return;

    // Acercamiento exponencial a la velocidad objetivo — nunca un salto.
    const targetScale = this.hovered ? MOTORBIKE.HOVER_SPEED_SCALE : 1;
    const k = 1 - Math.exp(-MOTORBIKE.HOVER_EASE * delta);
    this.speedScale += (targetScale - this.speedScale) * k;

    // El impulso del clic se disipa solo — un empujón, no un interruptor.
    this.kickVelocity *= Math.exp(-MOTORBIKE.KICK_FRICTION * delta);

    this.spinAngle += (MOTORBIKE.SPIN_SPEED * this.speedScale + this.kickVelocity) * delta;
    this.spin.rotation.y = this.spinAngle;
  }

  dispose(): void {
    this.environment?.dispose();
    this.root.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) material.dispose();
    });
  }
}
