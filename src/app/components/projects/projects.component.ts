import { AfterViewInit, Component, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { revealOnScroll } from '../../shared/reveal.util';

interface Project {
  index: string;
  title: string;
  description: string;
  stack: string[];
  githubUrl: string;
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
  readonly projects: Project[] = [
    {
      index: 'wa',
      title: 'Sistema de reservas por WhatsApp',
      description:
        'Sistema de reservas para una barbería que conecta con una API externa de WhatsApp para gestionar citas de forma automatizada, sin intervención manual.',
      stack: ['Java', 'Spring Boot', 'REST API', 'WhatsApp API'],
      githubUrl: 'https://github.com/roberto-dev/whatsapp-booking',
    },
    {
      index: 'tg',
      title: 'Bot de Telegram',
      description:
        'Bot conectado a APIs externas para automatizar procesos y obtener información en tiempo real directamente desde Telegram.',
      stack: ['Java', 'Telegram API', 'Integración de APIs'],
      githubUrl: 'https://github.com/roberto-dev/telegram-bot',
    },
    {
      index: '3d',
      title: 'Este portfolio',
      description:
        'Experiencia web 3D construida con Angular, Three.js y GSAP: personaje 3D, cámara cinematográfica y narrativa dirigida por scroll.',
      stack: ['Angular', 'TypeScript', 'Three.js', 'GSAP'],
      githubUrl: 'https://github.com/roberto-dev/roberto-portfolio',
      demoUrl: '#top',
    },
  ];

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    revealOnScroll(this.el.nativeElement, '[data-reveal-project]');
  }
}
