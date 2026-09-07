import { Injectable, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'portfolio.theme';

/**
 * Tema claro/oscuro.
 *
 * Arranca SIEMPRE en oscuro a petición explícita — no se mira
 * `prefers-color-scheme`: el oscuro es el aspecto para el que está diseñada
 * la escena 3D y con el que debe recibir a quien entra. Solo se respeta lo
 * que el propio visitante haya elegido antes.
 *
 * El tema se publica de dos formas porque tiene dos consumidores muy
 * distintos: un atributo `data-theme` en <html> para el CSS, y un signal para
 * que la escena de Three.js (que no ve el CSS) pueda repintar niebla y suelo.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly current = signal<Theme>('dark');

  init(): void {
    this.use(this.stored() ?? 'dark');
  }

  use(theme: Theme): void {
    this.current.set(theme);
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Almacenamiento bloqueado: se pierde entre visitas y no pasa nada más.
    }
  }

  toggle(): void {
    this.use(this.current() === 'dark' ? 'light' : 'dark');
  }

  private stored(): Theme | null {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'dark' || saved === 'light' ? saved : null;
    } catch {
      return null;
    }
  }
}
