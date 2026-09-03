import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { CAMERA } from './narrative.config';

/**
 * Envuelve la única cámara cinemática del narrativo.
 *
 * `lookTarget` es un Vector3 que el timeline escribe cada frame; el render
 * loop solo hace camera.lookAt(lookTarget), así que la "cinematografía" no es
 * más que animar dos vectores en función del scroll.
 *
 * Lo único que la cámara decide por su cuenta es `distanceScale`: cuánto hay
 * que alejarla para que el ancho de mundo que el narrativo necesita quepa en
 * la ventana actual. Depende del aspecto, no del scroll, así que se recalcula
 * solo al redimensionar.
 */
@Injectable({ providedIn: 'root' })
export class CameraService {
  readonly camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
  readonly lookTarget = new THREE.Vector3(0, 0.9, 0);

  /** Multiplicador de distancia cámara -> lookTarget. 1 = sin corrección. */
  private scale = 1;
  /** Semiancho de mundo visible en el plano del personaje, con el aspecto actual. */
  private halfWidth = 0;

  constructor() {
    this.camera.position.set(0, 1.3, 5.5);
    this.updateDistanceScale();
    window.addEventListener('resize', this.onResize, { passive: true });
  }

  get distanceScale(): number {
    return this.scale;
  }

  /**
   * Semiancho de mundo visible a la altura del personaje. Es lo que necesita
   * el timeline para saber cuánto tiene que andar hasta salirse de verdad del
   * cuadro, sea cual sea el aspecto de la ventana.
   */
  get visibleHalfWidth(): number {
    return this.halfWidth;
  }

  update(): void {
    this.camera.lookAt(this.lookTarget);
  }

  /**
   * Semiancho visible = tan(fovY / 2) * distancia * aspect. Se despeja la
   * distancia mínima que cubre REQUIRED_HALF_WIDTH y se compara con la que
   * pide el timeline; nunca se acerca, solo se aleja.
   */
  private updateDistanceScale(): void {
    const halfFovY = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const baseDistance = CAMERA.POSITION.z - CAMERA.LOOK_AT.z;
    const needed = CAMERA.REQUIRED_HALF_WIDTH / (Math.tan(halfFovY) * this.camera.aspect);
    this.scale = THREE.MathUtils.clamp(needed / baseDistance, 1, CAMERA.MAX_DISTANCE_SCALE);

    // El plano del personaje coincide con el punto al que mira la cámara
    // (CAMERA.LOOK_AT.z == WALK.BASE_Z), así que la distancia es la misma.
    this.halfWidth = Math.tan(halfFovY) * baseDistance * this.scale * this.camera.aspect;
  }

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.updateDistanceScale();
  };
}
