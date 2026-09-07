import { AfterViewInit, Component, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { revealOnScroll } from '../../shared/reveal.util';

/**
 * Aquí solo lo que NO se traduce. Cargo y viñetas viven en los JSON de i18n
 * bajo experience.items.<key>; el nombre de la empresa y el stack son los
 * mismos en los dos idiomas, y las fechas se parten en `from`/`to` para que
 * "Presente" pueda traducirse sin tener que duplicar el rango entero.
 */
interface ExperienceItem {
  key: string;
  company: string;
  from: string;
  /** null = sigue en el puesto; la plantilla pone "Presente"/"Present". */
  to: string | null;
  stack: string[];
}

@Component({
  selector: 'app-experience',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './experience.component.html',
  styleUrl: './experience.component.scss',
})
export class ExperienceComponent implements AfterViewInit {
  readonly items: ExperienceItem[] = [
    {
      key: 'slclab',
      company: 'SLCLAB',
      from: '2026',
      to: null,
      stack: ['.NET', 'Semantic Kernel', 'Angular', 'REST API', 'SQL', 'Postman', 'Git', 'Scrum'],
    },
    {
      key: 'getd',
      company: 'GETD',
      from: '2025',
      to: '2026',
      stack: ['Vue.js', 'ASP.NET Core', 'REST API', 'SQL', 'Git'],
    },
    {
      key: 'kyndryl',
      company: 'Kyndryl',
      from: '2024',
      to: '2025',
      stack: ['Java', 'Spring Boot', 'REST API', 'SQL', 'Git', 'Scrum'],
    },
  ];

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    revealOnScroll(this.el.nativeElement);
  }
}