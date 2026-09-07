import { Injectable, NgZone, OnDestroy } from '@angular/core';
import * as THREE from 'three';

/**
 * Única fuente de la posición del puntero, en coordenadas normalizadas de
 * dispositivo.
 *
 * El canvas de Three.js tiene pointer-events: none para no bloquear los clics
 * del resto de la página, así que esto escucha en window y el hit-test lo hace
 * quien lo consuma (AnimationService, contra la moto).
 */
@Injectable({ providedIn: 'root' })
export class PointerInteractionService implements OnDestroy {
  /** Arranca fuera de pantalla: antes de mover el ratón nada está "encima". */
  readonly ndc = new THREE.Vector2(-2, -2);

  constructor(private zone: NgZone) {
    this.zone.runOutsideAngular(() => {
      window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    });
  }

  private onPointerMove = (event: PointerEvent): void => {
    this.ndc.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.ndc.y = -(event.clientY / window.innerHeight) * 2 + 1;
  };

  ngOnDestroy(): void {
    window.removeEventListener('pointermove', this.onPointerMove);
  }
}
