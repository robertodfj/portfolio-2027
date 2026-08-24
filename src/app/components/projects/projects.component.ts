import {
  AfterViewInit,
  Component,
  ElementRef,
  ViewChild,
  signal,
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { revealOnScroll } from '../../shared/reveal.util';

interface Project {
  index: string;
  icon?: string;
  title: string;
  description: string;
  stack: string[];
  githubUrl?: string;
  demoUrl?: string;
}

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule],
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
      title: 'Rick & Morty Telegram Bot',
      description:
        'API en .NET con C# orientada a jugabilidad y trading de objetos a través de comandos de Telegram: autenticación con JWT, tienda de items, compraventa entre jugadores y persistencia con SQL.',
      stack: ['.NET', 'C#', 'JWT', 'Telegram API', 'SQL'],
    },
    {
      index: 'ma',
      icon: '🍽️',
      title: 'Mesero App',
      description:
        'Aplicación Android en Java para la gestión integral de bares: mesas, productos y comandas en tiempo real, control de stock, facturación automática por email y notificaciones. Persistencia con Room y SharedPreferences, UI reactiva con LiveData.',
      stack: ['Java', 'Android Studio', 'Room', 'LiveData'],
    },
    {
      index: 'mw',
      icon: '🍽️',
      title: 'Mesero Web',
      description:
        'Versión web del sistema de gestión de pedidos para restaurantes, con backend en Java y Spring Boot. En desarrollo activo.',
      stack: ['Java', 'Spring Boot'],
      demoUrl: 'https://www.youtube.com/watch?v=n2fKeVxJVg8&t=1s',
    },
    {
      index: 'mc',
      icon: '☁️',
      title: 'MiniCloud',
      description:
        'Sistema multiusuario para subir, descargar y eliminar archivos de forma segura, con cifrado automático y almacenamiento por usuario. Atiende múltiples clientes en paralelo mediante hilos en Java. Mi proyecto más reciente.',
      stack: ['Java', 'Multithreading', 'Cifrado'],
    },
    {
      index: 'tf',
      icon: '📋',
      title: 'TaskFlow',
      description:
        'Aplicación de gestión de proyectos inspirada en Jira: creación y asignación de tareas, seguimiento de estado en tiempo real. Backend con Spring Boot y frontend en React.',
      stack: ['Spring Boot', 'React'],
    },
    {
      index: 'rps',
      icon: '✊',
      title: 'Rock Paper Scissors',
      description:
        'Piedra, papel o tijera contra la cámara: combina lógica de juego en Java con visión por computadora, usando OpenCV para detectar en tiempo real la forma de la mano del usuario.',
      stack: ['Java', 'OpenCV'],
    },
  ];

  /*
   * Repetimos los proyectos 3 veces.
   *
   * La vista empieza en la copia central.
   * Cuando llegamos a una de las copias exteriores,
   * recolocamos el scroll en la copia central sin que
   * el usuario perciba el salto.
   */
  readonly carouselProjects = [
    ...this.projects,
    ...this.projects,
    ...this.projects,
  ];

  readonly activeIndex = signal(0);

  private dragging = false;
  private startX = 0;
  private startScrollLeft = 0;
  private scrollRaf = 0;
  private initialized = false;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    revealOnScroll(
      this.el.nativeElement,
      '[data-reveal-project]'
    );

    requestAnimationFrame(() => {
      this.goToPhysicalIndex(this.projects.length, false);
      this.initialized = true;
    });
  }

  /*
   * Índice físico dentro de las 3 copias.
   */
  private getCard(index: number): HTMLElement | null {
    const track = this.trackRef.nativeElement;

    return track.children[index] as HTMLElement | null;
  }

  /*
   * Lleva una tarjeta al centro de la pantalla.
   */
  private getTargetScroll(index: number): number {
    const track = this.trackRef.nativeElement;
    const card = this.getCard(index);

    if (!card) {
      return track.scrollLeft;
    }

    return (
      card.offsetLeft +
      card.offsetWidth / 2 -
      track.clientWidth / 2
    );
  }

  private goToPhysicalIndex(
    index: number,
    smooth = true
  ): void {
    const track = this.trackRef.nativeElement;

    track.scrollTo({
      left: this.getTargetScroll(index),
      behavior: smooth ? 'smooth' : 'auto',
    });
  }

  /*
   * Convierte el índice físico en el índice real.
   *
   * Ejemplo:
   * 6 -> 0
   * 7 -> 1
   * 8 -> 2
   */
  private normalizeIndex(index: number): number {
    const length = this.projects.length;

    return (
      ((index % length) + length) % length
    );
  }

  /*
   * Comprueba si estamos cerca de una copia exterior.
   *
   * Cuando ocurre, recolocamos el carrusel en la copia
   * central equivalente.
   */
  private normalizeInfinitePosition(): void {
    const track = this.trackRef.nativeElement;

    const total = this.carouselProjects.length;
    const length = this.projects.length;

    const cards = Array.from(
      track.children
    ) as HTMLElement[];

    if (!cards.length) return;

    const center =
      track.scrollLeft +
      track.clientWidth / 2;

    let closest = 0;
    let distance = Infinity;

    cards.forEach((card, index) => {
      const cardCenter =
        card.offsetLeft +
        card.offsetWidth / 2;

      const d = Math.abs(
        cardCenter - center
      );

      if (d < distance) {
        distance = d;
        closest = index;
      }
    });

    /*
     * Si estamos en la primera copia,
     * saltamos a la copia central.
     */
    if (closest < length) {
      const equivalent =
        closest + length;

      track.scrollLeft =
        this.getTargetScroll(equivalent);

      return;
    }

    /*
     * Si estamos en la tercera copia,
     * saltamos a la copia central.
     */
    if (closest >= length * 2) {
      const equivalent =
        closest - length;

      track.scrollLeft =
        this.getTargetScroll(equivalent);
    }

    /*
     * total se utiliza para mantener claro que
     * trabajamos con un carrusel circular.
     */
    void total;
  }

  /*
   * Actualiza la tarjeta activa.
   */
  onTrackScroll(): void {
    if (!this.initialized) return;

    if (this.scrollRaf) {
      cancelAnimationFrame(this.scrollRaf);
    }

    this.scrollRaf =
      requestAnimationFrame(() => {
        const track =
          this.trackRef.nativeElement;

        const cards = Array.from(
          track.children
        ) as HTMLElement[];

        if (!cards.length) return;

        const center =
          track.scrollLeft +
          track.clientWidth / 2;

        let closest = 0;
        let distance = Infinity;

        cards.forEach((card, index) => {
          const cardCenter =
            card.offsetLeft +
            card.offsetWidth / 2;

          const d = Math.abs(
            cardCenter - center
          );

          if (d < distance) {
            distance = d;
            closest = index;
          }
        });

        this.activeIndex.set(
          this.normalizeIndex(closest)
        );

        this.normalizeInfinitePosition();
      });
  }

  /*
   * Siguiente proyecto.
   */
  next(): void {
    const track =
      this.trackRef.nativeElement;

    const cards = Array.from(
      track.children
    ) as HTMLElement[];

    if (!cards.length) return;

    const center =
      track.scrollLeft +
      track.clientWidth / 2;

    let closest = 0;
    let distance = Infinity;

    cards.forEach((card, index) => {
      const cardCenter =
        card.offsetLeft +
        card.offsetWidth / 2;

      const d = Math.abs(
        cardCenter - center
      );

      if (d < distance) {
        distance = d;
        closest = index;
      }
    });

    this.goToPhysicalIndex(
      closest + 1,
      true
    );
  }

  /*
   * Proyecto anterior.
   */
  prev(): void {
    const track =
      this.trackRef.nativeElement;

    const cards = Array.from(
      track.children
    ) as HTMLElement[];

    if (!cards.length) return;

    const center =
      track.scrollLeft +
      track.clientWidth / 2;

    let closest = 0;
    let distance = Infinity;

    cards.forEach((card, index) => {
      const cardCenter =
        card.offsetLeft +
        card.offsetWidth / 2;

      const d = Math.abs(
        cardCenter - center
      );

      if (d < distance) {
        distance = d;
        closest = index;
      }
    });

    this.goToPhysicalIndex(
      closest - 1,
      true
    );
  }

  /*
   * Click en los puntos.
   *
   * Siempre navegamos a la copia central.
   */
  scrollToIndex(index: number): void {
    const physicalIndex =
      this.projects.length + index;

    this.goToPhysicalIndex(
      physicalIndex,
      true
    );
  }

  /*
   * Inicio del drag.
   */
  onPointerDown(event: PointerEvent): void {
    const track =
      this.trackRef.nativeElement;

    this.dragging = true;

    this.startX = event.clientX;
    this.startScrollLeft =
      track.scrollLeft;

    track.setPointerCapture(
      event.pointerId
    );

    track.classList.add(
      'is-dragging'
    );
  }

  /*
   * Movimiento del drag.
   */
  onPointerMove(event: PointerEvent): void {
    if (!this.dragging) return;

    const track =
      this.trackRef.nativeElement;

    const distance =
      event.clientX - this.startX;

    track.scrollLeft =
      this.startScrollLeft - distance;
  }

  /*
   * Fin del drag.
   */
  onPointerUp(event: PointerEvent): void {
    if (!this.dragging) return;

    const track =
      this.trackRef.nativeElement;

    this.dragging = false;

    track.classList.remove(
      'is-dragging'
    );

    if (
      track.hasPointerCapture(
        event.pointerId
      )
    ) {
      track.releasePointerCapture(
        event.pointerId
      );
    }

    this.snapToClosest();
  }

  onPointerCancel(
    event: PointerEvent
  ): void {
    if (!this.dragging) return;

    const track =
      this.trackRef.nativeElement;

    this.dragging = false;

    track.classList.remove(
      'is-dragging'
    );

    if (
      track.hasPointerCapture(
        event.pointerId
      )
    ) {
      track.releasePointerCapture(
        event.pointerId
      );
    }

    this.snapToClosest();
  }

  /*
   * Al soltar, busca la tarjeta más cercana
   * y la centra suavemente.
   */
  private snapToClosest(): void {
    const track =
      this.trackRef.nativeElement;

    const cards = Array.from(
      track.children
    ) as HTMLElement[];

    if (!cards.length) return;

    const center =
      track.scrollLeft +
      track.clientWidth / 2;

    let closest = 0;
    let distance = Infinity;

    cards.forEach((card, index) => {
      const cardCenter =
        card.offsetLeft +
        card.offsetWidth / 2;

      const d = Math.abs(
        cardCenter - center
      );

      if (d < distance) {
        distance = d;
        closest = index;
      }
    });

    this.goToPhysicalIndex(
      closest,
      true
    );
  }

  /*
   * Tilt muy sutil.
   */
  onTilt(event: MouseEvent): void {
    if (this.dragging) return;

    const card =
      event.currentTarget as HTMLElement;

    const rect =
      card.getBoundingClientRect();

    const px =
      (event.clientX - rect.left) /
      rect.width;

    const py =
      (event.clientY - rect.top) /
      rect.height;

    const rx =
      (0.5 - py) * 2;

    const ry =
      (px - 0.5) * 2.5;

    card.style.setProperty(
      '--rx',
      `${rx}deg`
    );

    card.style.setProperty(
      '--ry',
      `${ry}deg`
    );

    card.style.setProperty(
      '--mx',
      `${px * 100}%`
    );

    card.style.setProperty(
      '--my',
      `${py * 100}%`
    );
  }

  resetTilt(event: MouseEvent): void {
    const card =
      event.currentTarget as HTMLElement;

    card.style.setProperty(
      '--rx',
      '0deg'
    );

    card.style.setProperty(
      '--ry',
      '0deg'
    );
  }
}