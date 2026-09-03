import { AfterViewInit, Component, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { revealOnScroll } from '../../shared/reveal.util';

/**
 * Misma anatomía que ProjectCard (etiqueta mono + icono + título + texto),
 * para que las dos secciones se lean como el mismo sistema. La diferencia es
 * que aquí NO hay carrusel: son cuatro tarjetas fijas en una parrilla, todas
 * legibles de un vistazo.
 */
interface Trait {
  /** Etiqueta corta en mono, equivalente al índice de la tarjeta de proyecto. */
  label: string;
  icon: string;
  title: string;
  detail: string;
}

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent implements AfterViewInit {
  readonly traits: Trait[] = [
    {
      label: 'CODE',
      icon: '💻',
      title: 'Construir cosas',
      detail: 'Programar dejó de ser solo trabajo: casi cualquier idea acaba en un proyecto real.',
    },
    {
      label: 'GYM',
      icon: '🏋️',
      title: 'Entrenar',
      detail: 'Mi rutina fuera de la pantalla para llegar despejado al resto del día.',
    },
    {
      label: 'LEARN',
      icon: '📚',
      title: 'Formarme',
      detail: 'Siempre con algo entre manos hasta entender cómo funciona por dentro.',
    },
    {
      label: 'RIDE',
      icon: '🏍️',
      title: 'Las motos',
      detail: 'Mi mayor pasión y donde busco los retos que no están en un teclado.',
    },
  ];

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    revealOnScroll(this.el.nativeElement);
  }
}
