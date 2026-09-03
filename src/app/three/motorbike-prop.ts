import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MOTORBIKE } from './narrative.config';

/**
 * La moto de la sección "Más allá del código".
 *
 * Dos ejes bien separados:
 *   - PRESENCIA  -> la manda el scroll (entra y sale con la sección).
 *   - GIRO       -> lo manda el reloj (queda girando de forma continua).
 *
 * Jerarquía interna:
 *   root     posición/escala en mundo, la presencia escala aquí
 *    └ spin  rotación continua sobre el eje Y
 *       └ inner  el GLB, desplazado para que su centro caiga en el origen
 *                del pivote — sin esto la moto orbitaría en vez de girar.
 */
export class MotorbikeProp {
  readonly root = new THREE.Group();
  private readonly spin = new THREE.Group();
  private environment?: THREE.Texture;
  private presence = 0;

  constructor(inner: THREE.Group, renderer: THREE.WebGLRenderer) {
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
    this.root.scale.setScalar(t);
  }

  /**
   * Coloca la moto en SCREEN_X del encuadre actual — el hueco a la derecha del
   * texto — y la mete hacia dentro si el cuadro no da para mostrarla entera
   * (ventanas estrechas, donde la cámara ya no puede alejarse más).
   */
  setPlacement(cameraX: number, visibleHalfWidth: number): void {
    const half = MOTORBIKE.TARGET_HEIGHT / 2;
    const maxOffset = Math.max(0, visibleHalfWidth - half - MOTORBIKE.FRAME_PADDING);
    const desired = MOTORBIKE.SCREEN_X * visibleHalfWidth;
    this.root.position.x = cameraX + THREE.MathUtils.clamp(desired, -maxOffset, maxOffset);
  }

  /** Giro continuo. Solo corre mientras la moto está en escena. */
  update(elapsed: number): void {
    if (this.presence <= 0.001) return;
    this.spin.rotation.y = elapsed * MOTORBIKE.SPIN_SPEED;
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
