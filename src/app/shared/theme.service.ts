import { Injectable, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'portfolio.theme';

/**
 * Tema claro/oscuro. Arranca siempre en oscuro y no mira
 * `prefers-color-scheme`: el oscuro es el aspecto para el que está iluminada
 * la escena 3D. Solo se respeta lo que el visitante haya elegido antes.
 *
 * Se publica de dos formas porque tiene dos consumidores: un data-theme en
 * <html> para el CSS y un signal para la escena 3D, que no ve el CSS.
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
