import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SCROLL } from './narrative.config';

gsap.registerPlugin(ScrollTrigger);

/**
 * Anclajes de una sección del DOM, en el mismo progress global [0,1].
 *
 * Hacen falta los tres porque con secciones de 100vh seguidas `enter` cae en
 * progress 0 y no sirve: lo que marca "se está viendo esta sección" es `top`.
 */
export interface SectionRange {
  /** Su borde superior asoma por abajo del viewport. */
  enter: number;
  /** Su borde superior alcanza el borde superior del viewport: pasa a ocupar la pantalla. */
  top: number;
  /** Su borde inferior sale por arriba: deja de verse. */
  leave: number;
}

/**
 * Única fuente de verdad del scroll: un progress normalizado en [0,1].
 *
 * Un solo ScrollTrigger y un solo listener. No mantiene su propio rAF: el
 * bucle de render le pide una muestra por frame con sample(delta), así que
 * scroll y render van en fase sin acoplarse.
 *
 * El suavizado es un acercamiento exponencial independiente del framerate.
 * Nunca sobrepasa el objetivo, así que la animación no se adelanta al scroll.
 */
@Injectable({ providedIn: 'root' })
export class ScrollProgressService implements OnDestroy {
  /** Valor crudo que escribe ScrollTrigger. */
  private target = 0;
  /** Valor suavizado que consume la escena. */
  private current = 0;
  private trigger?: ScrollTrigger;

  /** Traducen "dónde está esta sección" al mismo eje [0,1] que todo lo demás. */
  private readonly sections = new Map<string, { selector: string; range: SectionRange }>();

  /** Viewport y recorrido total en px, cacheados en cada medida — base de vhToProgress(). */
  private viewportPx = 0;
  private scrollablePx = 0;

  constructor(private zone: NgZone) {}

  attach(host: HTMLElement): void {
    this.zone.runOutsideAngular(() => {
      this.trigger = ScrollTrigger.create({
        trigger: host,
        start: 'top top',
        end: 'bottom bottom',
        // Sin `scrub`: en un ScrollTrigger sin animación adjunta se ignora, y
        // aquí el suavizado lo queremos explícito y bajo nuestro control.
        onUpdate: (self) => {
          this.target = self.progress;
        },
        // Tras un resize/refresh el layout cambia: resincronizamos ambos
        // valores para no arrastrar un desfase heredado.
        onRefresh: (self) => {
          this.target = self.progress;
          this.current = self.progress;
          this.measureSections();
        },
      });
    });

    this.target = this.current = this.trigger?.progress ?? 0;
    this.measureSections();
  }

  /**
   * Declara una sección del DOM a seguir. Se mide ya y en cada refresh de
   * ScrollTrigger (resize, load, cambios de layout).
   */
  trackSection(key: string, selector: string): void {
    this.sections.set(key, { selector, range: { enter: 0, top: 0, leave: 1 } });
    this.measureSections();
  }

  /** Tramo global que ocupa la sección, o null si no se está siguiendo. */
  sectionRange(key: string): SectionRange | null {
    return this.sections.get(key)?.range ?? null;
  }

  private measureSections(): void {
    if (!this.sections.size) return;

    const viewport = window.innerHeight;
    const scrollable = document.documentElement.scrollHeight - viewport;
    if (scrollable <= 0) return;
    this.viewportPx = viewport;
    this.scrollablePx = scrollable;

    const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

    for (const entry of this.sections.values()) {
      const el = document.querySelector<HTMLElement>(entry.selector);
      if (!el) continue;

      const rect = el.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      entry.range.enter = clamp01((top - viewport) / scrollable);
      entry.range.top = clamp01(top / scrollable);
      entry.range.leave = clamp01((top + rect.height) / scrollable);
    }
  }

  /**
   * Pasa una distancia en vh a la misma unidad de progress, para poder anclar
   * "N vh antes de tal sección" sin depender de cuánto mida la página.
   * Devuelve 0 mientras el layout no se haya medido.
   */
  vhToProgress(vh: number): number {
    if (this.scrollablePx <= 0) return 0;
    return ((vh / 100) * this.viewportPx) / this.scrollablePx;
  }

  /** Progreso crudo, sin suavizar (útil para depurar la sincronía). */
  get raw(): number {
    return this.target;
  }

  /**
   * Avanza el valor suavizado `delta` segundos y lo devuelve.
   * Llamar EXACTAMENTE una vez por frame, desde el render loop.
   */
  sample(delta: number): number {
    if (SCROLL.SMOOTHING <= 0) {
      this.current = this.target;
      return this.current;
    }

    const k = 1 - Math.pow(1 - SCROLL.SMOOTHING, delta * 60);
    this.current += (this.target - this.current) * k;

    if (Math.abs(this.target - this.current) < SCROLL.SNAP_EPSILON) {
      this.current = this.target;
    }
    return this.current;
  }

  refresh(): void {
    this.trigger?.refresh();
  }

  dispose(): void {
    this.trigger?.kill();
    this.trigger = undefined;
  }

  ngOnDestroy(): void {
    this.dispose();
  }
}
