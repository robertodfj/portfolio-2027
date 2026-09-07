import {
  ChangeDetectionStrategy,
  Component,
  NgZone,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';

interface NavLink {
  /** Id de la sección Y clave de traducción (nav.<id> en los JSON de i18n). */
  id: string;
}

@Component({
  selector: 'app-navbar',
  imports: [CommonModule, TranslateModule, ThemeToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent implements OnDestroy {
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

  /** Debajo de este ancho el bloque de enlaces pasa a ser menú desplegable. */
  private readonly mobileLayout = signal(window.matchMedia('(max-width: 860px)').matches);

  /**
   * Menú plegado en móvil. Fuera de pantalla pero todavía en el DOM, así que
   * hay que marcarlo inert o el teclado tabula dentro de un menú invisible.
   */
  readonly menuHidden = computed(() => this.mobileLayout() && !this.menuOpen());

  private readonly zone = inject(NgZone);

  constructor() {
    // Fuera de la zona de Angular: el scroll dispara cientos de eventos por
    // segundo y no debe provocar un ciclo de detección de cambios por cada uno.
    this.zone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
    });

    this.breakpoint.addEventListener('change', this.onBreakpoint);
  }

  private readonly breakpoint = window.matchMedia('(max-width: 860px)');

  private onBreakpoint = (event: MediaQueryListEvent): void => {
    this.mobileLayout.set(event.matches);
  };

  private onScroll = (): void => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const next = max > 0 ? Math.round((doc.scrollTop / max) * 100) : 0;
    // Solo se vuelve a la zona cuando cambia el entero: la barra se mide en
    // porcentaje, así que los decimales no se ven y sí costarían un ciclo.
    if (next === this.progress()) return;
    this.zone.run(() => this.progress.set(next));
  };

  goTo(id: string): void {
    this.menuOpen.set(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll);
    this.breakpoint.removeEventListener('change', this.onBreakpoint);
  }
}
