import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Aparición de un grupo de elementos al entrar en pantalla.
 *
 * A propósito independiente del ScrollTrigger del narrativo: este solo toca
 * opacidad y transform, nunca la posición del scroll, así que no puede
 * pelearse con el scroll nativo.
 */
export function revealOnScroll(host: HTMLElement, selector = '[data-reveal]'): void {
  const targets = host.querySelectorAll<HTMLElement>(selector);
  if (!targets.length) return;

  gsap.fromTo(
    targets,
    { autoAlpha: 0, y: 28 },
    {
      autoAlpha: 1,
      y: 0,
      duration: 0.9,
      ease: 'power3.out',
      stagger: 0.08,
      scrollTrigger: {
        trigger: host,
        start: 'top 78%',
        toggleActions: 'play none none reverse',
      },
    },
  );
}
