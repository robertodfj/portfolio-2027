import { Injectable, NgZone, inject, signal } from '@angular/core';

/**
 * Pistas de interacción de la escena 3D.
 *
 * Las partes interactivas del 3D no tienen ningún affordance: nada indica que
 * la moto responda al ratón. Esto permite que la sección muestre un aviso y lo
 * retire en cuanto el visitante lo ha descubierto por su cuenta.
 */
@Injectable({ providedIn: 'root' })
export class SceneHintsService {
  private readonly zone = inject(NgZone);

  /** true en cuanto el puntero pasa por encima de la moto una primera vez. */
  readonly bikeFound = signal(false);

  /**
   * Se llama desde el bucle de render, que corre fuera de la zona de Angular.
   * Sin volver a entrar, la vista no se enteraría hasta el siguiente evento.
   */
  markBikeFound(): void {
    if (this.bikeFound()) return;
    this.zone.run(() => this.bikeFound.set(true));
  }
}
