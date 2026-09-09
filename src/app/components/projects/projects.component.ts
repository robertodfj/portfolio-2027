import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  signal,
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { revealOnScroll } from '../../shared/reveal.util';

interface Project {
  /**
   * Índice corto de la tarjeta y clave de traducción a la vez: los textos
   * viven en los JSON de i18n bajo projects.items.<index>.
   */
  index: string;
  icon?: string;
  stack: string[];
  /**
   * Repositorio privado. Con true la tarjeta muestra el botón de GitHub
   * bloqueado y se ignora githubUrl, así que abrir o cerrar el código de un
   * proyecto es cambiar este flag.
   */
  isPrivate: boolean;
  githubUrl?: string;
  demoUrl?: string;
}

@Component({
  selector: 'app-projects',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss',
})
export class ProjectsComponent implements AfterViewInit {
  @ViewChild('track', { static: true })
  trackRef!: ElementRef<HTMLElement>;

  readonly projects: Project[] = [
    {
      index: 'rm',
      icon: '🤖',
      stack: ['.NET', 'C#', 'JWT', 'Telegram API', 'SQL'],
      isPrivate: false,
      githubUrl: 'https://github.com/robertodfj/rick-morty',
    },
    {
      index: 'ma',
      icon: '🍽️',
      stack: ['Java', 'Android Studio', 'Room', 'LiveData'],
      isPrivate: false,
      githubUrl: 'https://github.com/robertodfj/meseroAPP-Proyecto-Intermodular',
    },
    {
      index: 'mw',
      icon: '🍽️',
      stack: ['Java', 'Spring Boot'],
      isPrivate: true,
      demoUrl: 'https://www.youtube.com/watch?v=n2fKeVxJVg8&t=1s',
    },
    {
      index: 'mc',
      icon: '☁️',
      stack: ['Java', 'Multithreading', 'Encryption'],
      isPrivate: false,
      githubUrl: 'https://github.com/robertodfj/MiniCloud',
    },
    {
      index: 'tf',
      icon: '📋',
      stack: ['Spring Boot', 'React'],
      isPrivate: false,
      githubUrl: 'https://github.com/robertodfj/TaskFlow',
    },
    {
      index: 'rps',
      icon: '✊',
      stack: ['Java', 'OpenCV'],
      isPrivate: false,
      githubUrl: 'https://github.com/robertodfj/rock-paper-scissors',
    },
  ];

  /**
   * Tres copias de la lista. La vista arranca en la del medio y, al llegar a
   * una de las exteriores, se recoloca el scroll en la central sin que se note
   * el salto. Las copias exteriores van marcadas aria-hidden en la plantilla
   * para que un lector de pantalla no lea los proyectos tres veces.
   */
  readonly carouselProjects = [...this.projects, ...this.projects, ...this.projects];

  readonly activeIndex = signal(0);

  private dragging = false;
  private startX = 0;
  private startScrollLeft = 0;
  private scrollRaf = 0;
  private initialized = false;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    revealOnScroll(this.el.nativeElement, '[data-reveal-project]');

    requestAnimationFrame(() => {
      this.goToPhysicalIndex(this.projects.length, false);
      this.initialized = true;
    });
  }

  /** true si la tarjeta es una de las copias, no la lista real. */
  isClone(i: number): boolean {
    return i < this.projects.length || i >= this.projects.length * 2;
  }

  next(): void {
    this.step(1);
  }

  prev(): void {
    this.step(-1);
  }

  /** Click en los puntos: siempre se navega a la copia central. */
  scrollToIndex(index: number): void {
    this.goToPhysicalIndex(this.projects.length + index, true);
  }

  onTrackScroll(): void {
    if (!this.initialized) return;

    cancelAnimationFrame(this.scrollRaf);
    this.scrollRaf = requestAnimationFrame(() => {
      const closest = this.closestCardIndex();
      if (closest < 0) return;

      this.activeIndex.set(this.normalizeIndex(closest));
      this.recenterIfOnOuterCopy(closest);
    });
  }

  onPointerDown(event: PointerEvent): void {
    // Solo con ratón. En táctil el arrastre lo hace el propio navegador: es
    // scroll nativo, con inercia y encaje, y sobre todo sabe distinguir un
    // gesto vertical (pasar página) de uno horizontal (mover el carrusel).
    //
    // Emulándolo a mano se capturaba el puntero en cuanto tocabas la sección,
    // así que un dedo apoyado sobre las tarjetas bloqueaba el scroll de la
    // página. Justo lo que pasaba en móvil sobre "Cosas que he construido".
    if (event.pointerType !== 'mouse') return;

    const track = this.trackRef.nativeElement;

    this.dragging = true;
    this.startX = event.clientX;
    this.startScrollLeft = track.scrollLeft;

    track.setPointerCapture(event.pointerId);
    track.classList.add('is-dragging');
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragging) return;

    const track = this.trackRef.nativeElement;
    track.scrollLeft = this.startScrollLeft - (event.clientX - this.startX);
  }

  onPointerUp(event: PointerEvent): void {
    this.endDrag(event);
  }

  onPointerCancel(event: PointerEvent): void {
    this.endDrag(event);
  }

  /** Inclinación muy sutil de la tarjeta bajo el ratón. */
  onTilt(event: MouseEvent): void {
    if (this.dragging) return;

    const card = event.currentTarget as HTMLElement;
    const rect = card.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;

    card.style.setProperty('--rx', `${(0.5 - py) * 2}deg`);
    card.style.setProperty('--ry', `${(px - 0.5) * 2.5}deg`);
    card.style.setProperty('--mx', `${px * 100}%`);
    card.style.setProperty('--my', `${py * 100}%`);
  }

  resetTilt(event: MouseEvent): void {
    const card = event.currentTarget as HTMLElement;
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  }

  /**
   * Tarjeta cuyo centro cae más cerca del centro del carrusel. Es la pregunta
   * que se hacen el scroll, las flechas y el soltar del arrastre, así que vive
   * en un único sitio.
   */
  private closestCardIndex(): number {
    const track = this.trackRef.nativeElement;
    const cards = Array.from(track.children) as HTMLElement[];
    if (!cards.length) return -1;

    const center = track.scrollLeft + track.clientWidth / 2;
    const distanceTo = (card: HTMLElement) =>
      Math.abs(card.offsetLeft + card.offsetWidth / 2 - center);

    let closest = 0;
    for (let i = 1; i < cards.length; i++) {
      if (distanceTo(cards[i]) < distanceTo(cards[closest])) closest = i;
    }
    return closest;
  }

  private step(direction: 1 | -1): void {
    const closest = this.closestCardIndex();
    if (closest < 0) return;
    this.goToPhysicalIndex(closest + direction, true);
  }

  private endDrag(event: PointerEvent): void {
    if (!this.dragging) return;

    const track = this.trackRef.nativeElement;
    this.dragging = false;
    track.classList.remove('is-dragging');

    if (track.hasPointerCapture(event.pointerId)) {
      track.releasePointerCapture(event.pointerId);
    }

    const closest = this.closestCardIndex();
    if (closest >= 0) this.goToPhysicalIndex(closest, true);
  }

  private getTargetScroll(index: number): number {
    const track = this.trackRef.nativeElement;
    const card = track.children[index] as HTMLElement | undefined;
    if (!card) return track.scrollLeft;

    return card.offsetLeft + card.offsetWidth / 2 - track.clientWidth / 2;
  }

  private goToPhysicalIndex(index: number, smooth = true): void {
    this.trackRef.nativeElement.scrollTo({
      left: this.getTargetScroll(index),
      behavior: smooth ? 'smooth' : 'auto',
    });
  }

  /** Índice físico (0..17) a índice real (0..5). */
  private normalizeIndex(index: number): number {
    const length = this.projects.length;
    return ((index % length) + length) % length;
  }

  /** Si estamos en una copia exterior, salta a la equivalente de la central. */
  private recenterIfOnOuterCopy(closest: number): void {
    const length = this.projects.length;
    if (!this.isClone(closest)) return;

    const equivalent = closest < length ? closest + length : closest - length;
    this.trackRef.nativeElement.scrollLeft = this.getTargetScroll(equivalent);
  }
}
