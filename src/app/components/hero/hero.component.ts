import { AfterViewInit, Component, ElementRef } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { revealOnScroll } from '../../shared/reveal.util';
import { LanguagePickerComponent } from '../language-picker/language-picker.component';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [TranslateModule, LanguagePickerComponent],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss',
})
export class HeroComponent implements AfterViewInit {
  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    revealOnScroll(this.el.nativeElement);
  }
}
