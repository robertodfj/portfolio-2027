import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Fades + lifts a group of elements into place as they enter the viewport.
 * Deliberately independent from the master narrative ScrollTrigger in
 * AnimationService — this one only affects text/UI opacity and transform,
 * never scroll position, so it can never fight native scrolling.
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
