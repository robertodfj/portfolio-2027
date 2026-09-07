import { Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type Lang = 'es' | 'en';

export const LANGS: readonly Lang[] = ['es', 'en'];

const STORAGE_KEY = 'portfolio.lang';

/**
 * Idioma de la interfaz. Fino a propósito: ngx-translate ya hace el trabajo
 * de cargar y resolver claves, así que esto solo decide con CUÁL arranca y se
 * encarga de recordarlo.
 *
 * Orden de prioridad al arrancar:
 *   1. Lo que el visitante eligió la última vez (localStorage).
 *   2. El idioma del navegador/equipo, a petición explícita.
 *   3. Inglés, por ser el que más gente entiende de los dos.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  /** Idioma activo. Signal para que las plantillas reaccionen al cambio. */
  readonly current = signal<Lang>('en');

  constructor(private translate: TranslateService) {}

  init(): void {
    this.translate.addLangs([...LANGS]);
    // Sin esto, una clave que falte en un idioma se pintaría como la clave
    // cruda ("nav.about") en vez de caer al otro idioma.
    this.translate.setDefaultLang('en');
    this.use(this.stored() ?? this.fromBrowser());
  }

  use(lang: Lang): void {
    this.current.set(lang);
    this.translate.use(lang);
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Modo incógnito o almacenamiento bloqueado: se pierde la preferencia
      // entre visitas, pero la página funciona igual. No es motivo de error.
    }
  }

  private stored(): Lang | null {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return LANGS.includes(saved as Lang) ? (saved as Lang) : null;
    } catch {
      return null;
    }
  }

  /**
   * `navigator.language` llega como "es", "es-ES", "en-GB"... así que se mira
   * solo la parte del idioma. Cualquier variante de español entra en español;
   * el resto, en inglés.
   */
  private fromBrowser(): Lang {
    const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const tag of tags) {
      const base = tag?.toLowerCase().split('-')[0];
      if (LANGS.includes(base as Lang)) return base as Lang;
    }
    return 'en';
  }
}
