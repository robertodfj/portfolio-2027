import { AfterViewInit, Component, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { revealOnScroll } from '../../shared/reveal.util';

interface ExperienceItem {
  role: string;
  focus: string;
  stack: string[];
  description: string;
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
      role: 'Backend · Java',
      focus: 'Foco principal',
      stack: ['Java', 'Spring Boot', 'REST API', 'SQL', 'Git', 'Postman'],
      description:
        'Diseño y consumo de APIs REST, modelado de datos y automatización de procesos sobre stacks Java/Spring.',
    },
    {
      role: 'Full Stack · .NET & JS',
      focus: 'Experiencia complementaria',
      stack: ['.NET', 'ASP.NET Core', 'Vue', 'Angular'],
      description:
        'Desarrollo de soluciones full stack integrando backend .NET con interfaces en Vue y Angular.',
    },
    {
      role: 'Integración & automatización',
      focus: 'Procesos reales',
      stack: ['APIs externas', 'Automatización', 'Integración de sistemas'],
      description:
        'Conexión de sistemas y automatización de flujos de trabajo mediante integración de APIs de terceros.',
    },
  ];

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    revealOnScroll(this.el.nativeElement);
  }
}
