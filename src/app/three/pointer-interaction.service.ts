import { Injectable, NgZone, OnDestroy } from '@angular/core';
import * as THREE from 'three';

/**
 * Única fuente de la posición del ratón/dedo, en coordenadas de dispositivo
 * normalizadas (NDC, [-1,1]), y de si hay un clic pendiente de consumir.
 *
 * Deliberadamente no sabe nada de Three.js más allá de Vector2 — no hace
 * raycasting ni conoce ningún objeto de la escena. Eso es responsabilidad de
 * quien la consuma (AnimationService, contra la moto). Mismo patrón que
 * ScrollProgressService: una única fuente de un input crudo, con un único
 * listener, consumida por el orquestador.
 *
 * El canvas de Three.js tiene `pointer-events: none` (para no bloquear los
 * clics del resto de la página) — por eso esto escucha en `window` y hace el
 * hit-test a mano en vez de depender de eventos DOM sobre el propio canvas.
 */
@Injectable({ providedIn: 'root' })
export class PointerInteractionService implements OnDestroy {
  /**
   * Posición del puntero en NDC. Arranca fuera de la pantalla — antes de que
   * el usuario mueva el ratón, nada debe leerse como "encima" de nada.
   */
  readonly ndc = new THREE.Vector2(-2, -2);

  private clicked = false;

  constructor(private zone: NgZone) {
    this.zone.runOutsideAngular(() => {
      window.addEventListener('pointermove', this.onPointerMove, { passive: true });
      window.addEventListener('pointerdown', this.onPointerDown, { passive: true });
    });
  }

  private onPointerMove = (event: PointerEvent): void => {
    this.ndc.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.ndc.y = -(event.clientY / window.innerHeight) * 2 + 1;
  };

  private onPointerDown = (): void => {
    this.clicked = true;
  };

  /**
   * Si hubo un clic desde la última llamada, lo consume (devuelve true una
   * única vez por clic) — así un clic no se queda "pegado" disparando su
   * efecto en todos los frames siguientes.
   */
  consumeClick(): boolean {
    if (!this.clicked) return false;
    this.clicked = false;
    return true;
  }

  ngOnDestroy(): void {
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerdown', this.onPointerDown);
  }
}
