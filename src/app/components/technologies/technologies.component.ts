import { AfterViewInit, Component, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { revealOnScroll } from '../../shared/reveal.util';

interface Tech {
  name: string;
  note: string;
}

@Component({
  selector: 'app-technologies',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './technologies.component.html',
  styleUrl: './technologies.component.scss',
})
export class TechnologiesComponent implements AfterViewInit {
  readonly technologies: Tech[] = [
    { name: 'Java', note: 'Backend principal' },
    { name: 'Spring Boot', note: 'APIs y servicios' },
    { name: 'C#', note: 'Full stack .NET' },
    { name: '.NET', note: 'Backend alternativo' },
    { name: 'ASP.NET Core', note: 'APIs web' },
    { name: 'Angular', note: 'SPA / frontend' },
    { name: 'Vue', note: 'Frontend ligero' },
    { name: 'JavaScript', note: 'Base del frontend' },
    { name: 'TypeScript', note: 'Tipado a escala' },
    { name: 'SQL', note: 'Modelado de datos' },
    { name: 'REST API', note: 'Diseño de servicios' },
    { name: 'Git', note: 'Control de versiones' },
    { name: 'Postman', note: 'Testing de APIs' },
    { name: 'Docker', note: 'Entornos reproducibles' },
  ];

  readonly hovered = signal<string | null>(null);

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    revealOnScroll(this.el.nativeElement);
  }

  setHovered(name: string | null): void {
    this.hovered.set(name);
  }
}
