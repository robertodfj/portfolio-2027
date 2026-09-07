import * as THREE from 'three';

const W = 1024;
const H = 652;
const PAD = 40;
const GUTTER = 62;
const LINE_H = 40;
const FONT = '27px "JetBrains Mono", ui-monospace, monospace';

const COLORS = {
  bg: '#0b0b10',
  chrome: '#15151c',
  gutter: '#3a3a46',
  text: '#c9c9d4',
  string: '#8fd0a0',
  comment: '#5a5a68',
  number: '#e0a86a',
  type: '#7fb0e8',
};

const KEYWORDS =
  /\b(public|private|protected|sealed|record|class|interface|void|return|static|final|const|let|var|function|export|import|from|async|await|new|if|else|for|while|try|catch|throw|extends|implements|readonly|type|as|is|SELECT|FROM|JOIN|WHERE|GROUP|ORDER|BY|DESC|AS|SUM|COUNT|FROM|WORKDIR|COPY|EXPOSE|ENTRYPOINT|POST|GET)\b/g;

interface Token {
  text: string;
  color: string;
}

/**
 * Editor de código dibujado en un canvas y usado como textura de la pantalla
 * del portátil. El texto se escribe conforme avanza el scroll, así que las
 * manos del personaje y lo que aparece en pantalla van a la vez.
 */
export class CodeScreen {
  readonly texture: THREE.CanvasTexture;

  private readonly ctx: CanvasRenderingContext2D;
  private code = '';
  private revealed = -1;
  private accent = '#6e7bff';

  constructor() {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    this.ctx = canvas.getContext('2d')!;

    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
  }

  setCode(code: string): void {
    if (code === this.code) return;
    this.code = code;
    this.revealed = -1;
  }

  setAccent(css: string): void {
    if (css === this.accent) return;
    this.accent = css;
    this.revealed = -1;
  }

  /** `t` en [0,1]: fracción del fragmento que ya se ha escrito. */
  setProgress(t: number): void {
    const chars = Math.round(Math.max(0, Math.min(1, t)) * this.code.length);
    if (chars === this.revealed) return;
    this.revealed = chars;
    this.draw();
  }

  dispose(): void {
    this.texture.dispose();
  }

  private draw(): void {
    const ctx = this.ctx;

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    // Barra de título con los tres puntos: es lo que lo hace leer como un
    // editor y no como un bloque de texto.
    ctx.fillStyle = COLORS.chrome;
    ctx.fillRect(0, 0, W, 40);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(26 + i * 22, 20, 6, 0, Math.PI * 2);
      ctx.fillStyle = ['#ff5f57', '#febc2e', '#28c840'][i];
      ctx.fill();
    }

    ctx.font = FONT;
    ctx.textBaseline = 'top';

    const lines = this.code.slice(0, this.revealed).split('\n');
    const totalLines = this.code.split('\n').length;

    for (let i = 0; i < totalLines; i++) {
      const y = 66 + i * LINE_H;
      if (y > H - PAD) break;

      ctx.fillStyle = COLORS.gutter;
      ctx.fillText(String(i + 1).padStart(2, ' '), PAD, y);

      const line = lines[i];
      if (line === undefined) continue;

      let x = PAD + GUTTER;
      for (const token of this.tokenize(line)) {
        ctx.fillStyle = token.color;
        ctx.fillText(token.text, x, y);
        x += ctx.measureText(token.text).width;
      }

      // Cursor al final de lo escrito.
      if (i === lines.length - 1 && this.revealed < this.code.length) {
        ctx.fillStyle = this.accent;
        ctx.fillRect(x + 2, y + 3, 14, 29);
      }
    }

    this.texture.needsUpdate = true;
  }

  /** Coloreado por tramos: comentarios y cadenas primero, luego el resto. */
  private tokenize(line: string): Token[] {
    const outer = line.match(/^(\s*)(\/\/.*|#.*|--.*)$/);
    if (outer) {
      return [
        { text: outer[1], color: COLORS.text },
        { text: outer[2], color: COLORS.comment },
      ];
    }

    const tokens: Token[] = [];
    const pattern = /("[^"]*"|'[^']*'|`[^`]*`)|(\b\d+(?:\.\d+)?\b)|(@\w+)|(\b[A-Z]\w+\b)/g;
    let last = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(line))) {
      if (match.index > last) tokens.push(...this.plain(line.slice(last, match.index)));
      const color = match[1]
        ? COLORS.string
        : match[2]
          ? COLORS.number
          : match[3]
            ? this.accent
            : COLORS.type;
      tokens.push({ text: match[0], color });
      last = pattern.lastIndex;
    }
    if (last < line.length) tokens.push(...this.plain(line.slice(last)));
    return tokens;
  }

  /** Resalta las palabras clave con el acento activo. */
  private plain(text: string): Token[] {
    const tokens: Token[] = [];
    let last = 0;
    let match: RegExpExecArray | null;
    KEYWORDS.lastIndex = 0;

    while ((match = KEYWORDS.exec(text))) {
      if (match.index > last) tokens.push({ text: text.slice(last, match.index), color: COLORS.text });
      tokens.push({ text: match[0], color: this.accent });
      last = KEYWORDS.lastIndex;
    }
    if (last < text.length) tokens.push({ text: text.slice(last), color: COLORS.text });
    return tokens;
  }
}
