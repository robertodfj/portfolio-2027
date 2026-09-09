import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-loading-screen',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './loading-screen.component.html',
  styleUrl: './loading-screen.component.scss',
  host: { '[class.is-leaving]': 'leaving()' },
})
export class LoadingScreenComponent {
  /**
   * Arranca el fundido de salida.
   *
   * Antes lo disparaba una `animation` de CSS con retardo fijo, cuadrada a mano
   * con el `setTimeout` que quitaba el componente. En cuanto la carga dura algo
   * distinto de ese retardo, el velo se va antes de que la escena esté lista y
   * se ve montarse. Ahora lo manda quien sabe si ha terminado.
   */
  readonly leaving = input(false);
}
