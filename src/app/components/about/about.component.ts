import { AfterViewInit, Component, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { revealOnScroll } from '../../shared/reveal.util';

interface Trait {
  label: string;
  detail: string;
}

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent implements AfterViewInit {
  readonly traits: Trait[] = [
    { label: 'CODE', detail: 'Backend Java, APIs REST, integraciones' },
    { label: 'BUILD', detail: 'Proyectos propios de principio a fin' },
    { label: 'LEARN', detail: 'Nuevo stack cada vez que hace falta' },
    { label: 'RIDE', detail: 'La moto es el otro modo de despejarme' },
  ];

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    revealOnScroll(this.el.nativeElement);
  }
}
