import { AfterViewInit, Component, ElementRef, ViewChild, signal } from '@angular/core';
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
  @ViewChild('track', { static: true }) trackRef!: ElementRef<HTMLElement>;

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

  readonly activeIndex = signal(0);

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    revealOnScroll(this.el.nativeElement, '[data-reveal-project]');
  }

  scrollToIndex(i: number): void {
    const track = this.trackRef.nativeElement;
    const card = track.children[i] as HTMLElement | undefined;
    if (!card) return;
    track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: 'smooth' });
  }

  next(): void {
    this.scrollToIndex(Math.min(this.activeIndex() + 1, this.projects.length - 1));
  }

  prev(): void {
    this.scrollToIndex(Math.max(this.activeIndex() - 1, 0));
  }

  /** Keeps the active dot / arrow-disabled state in sync with native scroll (mouse, trackpad or swipe). */
  onTrackScroll(): void {
    const track = this.trackRef.nativeElement;
    const cards = Array.from(track.children) as HTMLElement[];
    if (!cards.length) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let closest = 0;
    let min = Infinity;
    cards.forEach((c, i) => {
      const cardCenter = c.offsetLeft - track.offsetLeft + c.clientWidth / 2;
      const d = Math.abs(cardCenter - center);
      if (d < min) {
        min = d;
        closest = i;
      }
    });
    this.activeIndex.set(closest);
  }

  /** Liquid-glass tilt + moving specular highlight, driven purely by CSS custom properties. */
  onTilt(event: MouseEvent): void {
    const card = event.currentTarget as HTMLElement;
    const rect = card.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    const rx = (0.5 - py) * 14;
    const ry = (px - 0.5) * 16;
    card.style.setProperty('--rx', `${rx}deg`);
    card.style.setProperty('--ry', `${ry}deg`);
    card.style.setProperty('--mx', `${px * 100}%`);
    card.style.setProperty('--my', `${py * 100}%`);
  }

  resetTilt(event: MouseEvent): void {
    const card = event.currentTarget as HTMLElement;
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  }
}