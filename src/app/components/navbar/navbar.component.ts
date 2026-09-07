import { Component, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';

interface NavLink {
  /** Id de la sección Y clave de traducción (nav.<id> en los JSON de i18n). */
  id: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, TranslateModule, ThemeToggleComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  /**
   * Solo ids: la etiqueta la pone i18n. Que el id sirva a la vez de destino
   * del scroll y de clave de traducción evita tener que mantener dos listas
   * en paralelo.
   */
  readonly links: NavLink[] = [
    { id: 'about' },
    { id: 'experience' },
    { id: 'technologies' },
    { id: 'projects' },
    { id: 'contact' },
  ];

  readonly progress = signal(0);
  readonly menuOpen = signal(false);

  @HostListener('window:scroll')
  onScroll(): void {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    this.progress.set(max > 0 ? (doc.scrollTop / max) * 100 : 0);
  }

  goTo(id: string): void {
    this.menuOpen.set(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }
}
