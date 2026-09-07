import { AfterViewInit, Component, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { revealOnScroll } from '../../shared/reveal.util';

interface Tech {
  /** El nombre no se traduce: "Java" es "Java" en todos los idiomas. */
  name: string;
  /** Clave bajo tech.notes.* en los JSON de i18n. */
  key: string;
}

@Component({
  selector: 'app-technologies',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './technologies.component.html',
  styleUrl: './technologies.component.scss',
})
export class TechnologiesComponent implements AfterViewInit {
  readonly technologies: Tech[] = [
    { name: 'Java', key: 'java' },
    { name: 'Spring Boot', key: 'spring' },
    { name: 'C#', key: 'csharp' },
    { name: '.NET', key: 'dotnet' },
    { name: 'ASP.NET Core', key: 'aspnet' },
    { name: 'Angular', key: 'angular' },
    { name: 'Vue', key: 'vue' },
    { name: 'JavaScript', key: 'javascript' },
    { name: 'TypeScript', key: 'typescript' },
    { name: 'SQL', key: 'sql' },
    { name: 'REST API', key: 'rest' },
    { name: 'Git', key: 'git' },
    { name: 'Postman', key: 'postman' },
    { name: 'Docker', key: 'docker' },
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
