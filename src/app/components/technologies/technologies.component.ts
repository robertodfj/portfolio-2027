import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { revealOnScroll } from '../../shared/reveal.util';
import { AccentService } from '../../shared/accent.service';
import { TECHNOLOGIES, Tech } from '../../shared/tech-catalog';

/**
 * Parrilla de tecnologías. Cada tarjeta es un botón de verdad: al pulsarla,
 * su color de marca pasa a ser el acento de toda la página y su código aparece
 * en la pantalla del portátil de la escena 3D.
 */
@Component({
  selector: 'app-technologies',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule],
  templateUrl: './technologies.component.html',
  styleUrl: './technologies.component.scss',
})
export class TechnologiesComponent implements AfterViewInit {
  private readonly accent = inject(AccentService);

  readonly technologies = TECHNOLOGIES;
  readonly hovered = signal<string | null>(null);
  readonly selected = this.accent.selected;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    revealOnScroll(this.el.nativeElement);
  }

  setHovered(name: string | null): void {
    this.hovered.set(name);
  }

  toggle(tech: Tech): void {
    this.accent.toggle(tech);
  }
}
