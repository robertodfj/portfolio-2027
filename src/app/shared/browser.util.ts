/** Lee un token de color de :root y lo devuelve como entero 0xRRGGBB. */
export function cssColorHex(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return /^#[0-9a-f]{6}$/i.test(raw) ? parseInt(raw.slice(1), 16) : fallback;
}

/** true si el visitante ha pedido menos movimiento en su sistema. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** Contraste WCAG entre dos colores 0xRRGGBB. */
export function contrastRatio(a: number, b: number): number {
  const lum = (c: number) => {
    const ch = [(c >> 16) & 255, (c >> 8) & 255, c & 255].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Acerca o aleja `color` del fondo hasta que alcanza `min` de contraste.
 * Sirve para aceptar un color de marca cualquiera sin romper la legibilidad.
 */
export function ensureContrast(color: number, background: number, min = 4.5): number {
  if (contrastRatio(color, background) >= min) return color;

  const bgIsDark = contrastRatio(0xffffff, background) > contrastRatio(0x000000, background);
  const towards = bgIsDark ? 255 : 0;
  let [r, g, b] = [(color >> 16) & 255, (color >> 8) & 255, color & 255];

  for (let i = 0; i < 24; i++) {
    r += (towards - r) * 0.08;
    g += (towards - g) * 0.08;
    b += (towards - b) * 0.08;
    const next = (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
    if (contrastRatio(next, background) >= min) return next;
  }
  return towards === 255 ? 0xffffff : 0x000000;
}

export const hexToCss = (hex: number): string => '#' + hex.toString(16).padStart(6, '0');
export const hexToRgbCss = (hex: number): string =>
  `${(hex >> 16) & 255}, ${(hex >> 8) & 255}, ${hex & 255}`;
