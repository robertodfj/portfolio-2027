import { AfterViewInit, Component, ElementRef } from '@angular/core';
import { revealOnScroll } from '../../shared/reveal.util';

@Component({
  selector: 'app-contact',
  standalone: true,
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss',
})
export class ContactComponent implements AfterViewInit {
  readonly email = 'robertodfj93@gmail.com';
  readonly githubUrl = 'https://github.com/robertodfj';
  readonly linkedinUrl = 'https://linkedin.com/in/robertodfj';

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    revealOnScroll(this.el.nativeElement);
  }
}
