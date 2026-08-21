import { Injectable } from '@angular/core';
import * as THREE from 'three';

/**
 * Wraps the single cinematic camera used throughout the scroll narrative.
 * `lookTarget` is a plain Vector3 that GSAP tweens directly; every frame we
 * just call camera.lookAt(lookTarget) so the "cinematography" is nothing
 * more than animating two vectors over scroll progress.
 */
@Injectable({ providedIn: 'root' })
export class CameraService {
  readonly camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
  readonly lookTarget = new THREE.Vector3(0, 0.9, 0);

  constructor() {
    this.camera.position.set(0, 1.3, 5.5);
    window.addEventListener('resize', this.onResize, { passive: true });
  }

  update(): void {
    this.camera.lookAt(this.lookTarget);
  }

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  };
}
