import { AfterViewInit, Component, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { revealOnScroll } from '../../shared/reveal.util';

/**
 * Misma anatomía que ProjectCard (etiqueta mono + icono + título + texto),
 * para que las dos secciones se lean como el mismo sistema. La diferencia es
 * que aquí NO hay carrusel: son cuatro tarjetas fijas en una parrilla, todas
 * legibles de un vistazo.
 */
interface Trait {
  /** Clave bajo about.traits.* en los JSON de i18n. */
  key: string;
  /** Etiqueta corta en mono, equivalente al índice de la tarjeta de proyecto. */
  label: string;
  icon: string;
}

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent implements AfterViewInit {
  /**
   * Solo lo que NO se traduce: la etiqueta en mono (un código, igual en los
   * dos idiomas) y el icono. Título y texto viven en los JSON de i18n.
   */
  readonly traits: Trait[] = [
    { key: 'code', label: 'CODE', icon: '💻' },
    { key: 'gym', label: 'GYM', icon: '🏋️' },
    { key: 'learn', label: 'LEARN', icon: '📚' },
    { key: 'ride', label: 'RIDE', icon: '🏍️' },
  ];

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    revealOnScroll(this.el.nativeElement);
  }
}
