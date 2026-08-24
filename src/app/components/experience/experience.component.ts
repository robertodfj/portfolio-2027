import { AfterViewInit, Component, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { revealOnScroll } from '../../shared/reveal.util';

interface ExperienceItem {
  role: string;
  company: string;
  period: string;
  bullets: string[];
  stack: string[];
}

@Component({
  selector: 'app-experience',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './experience.component.html',
  styleUrl: './experience.component.scss',
})
export class ExperienceComponent implements AfterViewInit {
  readonly items: ExperienceItem[] = [
    {
      role: 'Full Stack + IA Developer',
      company: 'SLCLAB',
      period: '2026 — Presente',
      bullets: [
        'Desarrollo de soluciones para automatización de procesos de soporte mediante IA con .NET y Semantic Kernel.',
        'Desarrollo de aplicaciones web con Angular.',
        'Integración de APIs REST y automatización de flujos de trabajo.',
        'Trabajo con SQL y Postman para integración y pruebas de servicios.',
        'Uso de Git y metodologías ágiles Scrum.',
      ],
      stack: ['.NET', 'Semantic Kernel', 'Angular', 'REST API', 'SQL', 'Postman', 'Git', 'Scrum'],
    },
    {
      role: 'Junior .NET Full Stack Developer',
      company: 'GETD',
      period: '2025 — 2026',
      bullets: [
        'Desarrollo de aplicaciones web Full Stack con Vue.js y ASP.NET Core.',
        'Creación e integración de APIs REST.',
        'Desarrollo de lógica de negocio e integración con bases de datos.',
        'Trabajo con Git en entornos colaborativos.',
      ],
      stack: ['Vue.js', 'ASP.NET Core', 'REST API', 'SQL', 'Git'],
    },
    {
      role: 'Java & Spring Boot Backend Developer',
      company: 'Kyndryl',
      period: '2024 — 2025',
      bullets: [
        'Desarrollo de soluciones backend para automatización de procesos.',
        'Desarrollo e integración de APIs REST con Java y Spring Boot.',
        'Automatización de flujos de trabajo.',
        'Gestión y consulta de datos mediante SQL.',
        'Uso de Git y metodologías Scrum.',
      ],
      stack: ['Java', 'Spring Boot', 'REST API', 'SQL', 'Git', 'Scrum'],
    },
  ];

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    revealOnScroll(this.el.nativeElement);
  }
}