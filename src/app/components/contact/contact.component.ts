import { AfterViewInit, Component, ElementRef } from '@angular/core';
import { revealOnScroll } from '../../shared/reveal.util';

@Component({
  selector: 'app-contact',
  standalone: true,
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss',
})
export class ContactComponent implements AfterViewInit {
  readonly email = 'roberto.defrutos.dev@gmail.com';
  readonly githubUrl = 'https://github.com/roberto-dev';
  readonly linkedinUrl = 'https://linkedin.com/in/roberto-de-frutos';

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    revealOnScroll(this.el.nativeElement);
  }
}
