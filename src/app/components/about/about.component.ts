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
    { label: 'CODE', detail: 'Más que un trabajo un hobby' },
    { label: 'GYM', detail: 'Estar agusto físicamente' },
    { label: 'LEARN', detail: 'Constantemente formándome' },
    { label: 'RIDE', detail: 'Mi mayor pasión' },
  ];

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    revealOnScroll(this.el.nativeElement);
  }
}
