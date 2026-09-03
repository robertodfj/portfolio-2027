import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SCROLL } from './narrative.config';

gsap.registerPlugin(ScrollTrigger);

/**
 * ÚNICA fuente de verdad del scroll: expone un `scrollProgress` normalizado
 * en [0, 1].
 *
 * Un solo ScrollTrigger, un solo listener. No mantiene rAF propio: el render
 * loop de Three.js le pide una muestra por frame vía `sample(delta)`, con lo
 * que el cálculo del scroll y el bucle de render quedan desacoplados pero
 * perfectamente en fase.
 *
 * Nota sobre el suavizado: es un acercamiento exponencial al valor real de
 * ScrollTrigger, independiente del framerate. Nunca sobrepasa el objetivo
 * (no hay inercia ni muelle), así que la animación jamás se adelanta al
 * scroll, y el snap por epsilon garantiza que al detenerse el scroll el
 * timeline se para en seco en el valor exacto.
 */
/**
 * Anclajes de una sección del DOM, en el MISMO scrollProgress global.
 *
 * Hacen falta los tres porque con secciones de 100vh seguidas, `enter` cae en
 * progress 0 y no sirve para nada: lo que marca "el usuario está viendo esta
 * sección" es `top`.
 */
export interface SectionRange {
  /** Su borde superior asoma por abajo del viewport. */
  enter: number;
  /** Su borde superior alcanza el borde superior del viewport: pasa a ocupar la pantalla. */
  top: number;
  /** Su borde inferior sale por arriba: deja de verse. */
  leave: number;
}

@Injectable({ providedIn: 'root' })
export class ScrollProgressService implements OnDestroy {
  /** Valor crudo que escribe ScrollTrigger. */
  private target = 0;
  /** Valor suavizado que consume la escena. */
  private current = 0;
  private trigger?: ScrollTrigger;

  /**
   * Secciones cuyo tramo se mide del DOM. No son un segundo sistema de
   * scroll: solo traducen "dónde está esta sección" al mismo eje [0,1] que ya
   * usa todo lo demás, para que nadie tenga que hardcodear progresos.
   */
  private readonly sections = new Map<string, { selector: string; range: SectionRange }>();

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
