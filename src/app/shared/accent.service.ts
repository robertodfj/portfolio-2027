import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { cssColorHex, ensureContrast, hexToCss, hexToRgbCss } from './browser.util';
import { TECHNOLOGIES, Tech } from './tech-catalog';
import { ThemeService } from './theme.service';

/**
 * Color de acento de la página. Por defecto es el índigo de los tokens; al
 * elegir una tecnología pasa a ser su color de marca, y con él se retiñe todo
 * lo que use --accent, incluida la escena 3D.
 *
 * El color de marca nunca se aplica tal cual: se corrige antes contra el fondo
 * del tema activo hasta que llega a 4.5:1, porque hay marcas (el amarillo de
 * JavaScript, sin ir más lejos) que sobre fondo claro son ilegibles.
 */
@Injectable({ providedIn: 'root' })
export class AccentService {
  private readonly theme = inject(ThemeService);

  /** Clave de la tecnología elegida, o null si está el acento por defecto. */
  readonly selected = signal<string | null>(null);

  readonly selectedTech = computed(() => {
    const key = this.selected();
    return key ? (TECHNOLOGIES.find((t) => t.key === key) ?? null) : null;
  });

  /** Acento efectivo en 0xRRGGBB. Lo consume la escena 3D. */
  readonly accentHex = signal(0x6e7bff);

  constructor() {
    // El tema cambia el fondo, así que la corrección de contraste hay que
    // rehacerla: el mismo color de marca necesita otro ajuste sobre blanco.
    effect(() => {
      this.theme.current();
      this.apply(this.selectedTech());
    });
  }

  toggle(tech: Tech): void {
    this.selected.update((key) => (key === tech.key ? null : tech.key));
    this.apply(this.selectedTech());
  }

  clear(): void {
    this.selected.set(null);
    this.apply(null);
  }

  private apply(tech: Tech | null): void {
    const root = document.documentElement;

    if (!tech) {
      for (const prop of ['--accent', '--accent-rgb', '--accent-dim']) {
        root.style.removeProperty(prop);
      }
      this.accentHex.set(cssColorHex('--accent', 0x6e7bff));
      return;
    }

    const stage = cssColorHex('--stage', 0x08080a);
    const safe = ensureContrast(tech.color, stage);

    root.style.setProperty('--accent', hexToCss(safe));
    root.style.setProperty('--accent-rgb', hexToRgbCss(safe));
    root.style.setProperty('--accent-dim', hexToCss(safe) + '33');
    this.accentHex.set(safe);
  }
}
