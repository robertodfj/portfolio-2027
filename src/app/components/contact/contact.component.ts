import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { revealOnScroll } from '../../shared/reveal.util';

/**
 * Una línea de la terminal. Se guarda la CLAVE de traducción, no el texto ya
 * resuelto: así el historial también cambia de idioma si el visitante cambia
 * el selector a mitad, y no depende de que el JSON de i18n ya esté cargado.
 */
interface Line {
  key?: string;
  params?: Record<string, string>;
  /** Texto literal (una URL, un email, o lo que ha escrito el visitante). */
  text?: string;
  echo?: boolean;
}

@Component({
  selector: 'app-contact',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss',
})
export class ContactComponent implements AfterViewInit {
  readonly email = 'robertodfj93@gmail.com';
  readonly githubUrl = 'https://github.com/robertodfj';
  readonly linkedinUrl = 'https://linkedin.com/in/robertodfj';
  readonly year = new Date().getFullYear();

  readonly command = signal('');
  readonly lines = signal<Line[]>([{ key: 'contact.terminal.welcome' }]);

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    revealOnScroll(this.el.nativeElement);
  }

  submit(): void {
    const raw = this.command().trim();
    this.command.set('');
    if (!raw) return;

    this.print({ text: raw, echo: true });
    this.run(raw.toLowerCase());
  }

  private run(command: string): void {
    switch (command) {
      case 'help':
        this.print({ key: 'contact.terminal.help' });
        break;
      case 'email':
      case 'hire':
        this.print({ text: this.email });
        window.location.href = `mailto:${this.email}`;
        break;
      case 'github':
        this.print({ text: this.githubUrl });
        this.open(this.githubUrl);
        break;
      case 'linkedin':
        this.print({ text: this.linkedinUrl });
        this.open(this.linkedinUrl);
        break;
      case 'whoami':
        this.print({ key: 'contact.terminal.whoami' });
        break;
      case 'clear':
        this.lines.set([]);
        break;
      default:
        this.print({ key: 'contact.terminal.unknown', params: { command } });
    }
  }

  private open(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /** Solo se guardan las últimas líneas: la terminal no debe crecer sin fin. */
  private print(line: Line): void {
    this.lines.update((lines) => [...lines, line].slice(-8));
  }
}
