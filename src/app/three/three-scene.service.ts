import { Injectable, NgZone, OnDestroy } from '@angular/core';
import * as THREE from 'three';
import { cssColorHex } from '../shared/browser.util';

/**
 * Ajustes 3D de cada tema.
 *
 * La niebla va al mismo color que el fondo de la página: es lo que hace que lo
 * lejano se disuelva en él en vez de recortarse contra él.
 *
 * La iluminación cambia con el tema y no es un capricho: la escena está
 * modelada en negros, y sobre un fondo casi blanco esos negros se leen como una
 * silueta recortada. En claro hace falta bastante más luz de relleno para que
 * el personaje y el mueble recuperen volumen.
 */
const THEMES = {
  dark: {
    fog: 0x08080a,
    ground: 0x0a0a0d,
    hemiSky: 0x9aa5ff,
    hemiGround: 0x0a0a0c,
    hemiIntensity: 0.55,
    keyIntensity: 1.6,
    fillIntensity: 0.35,
    exposure: 1.05,
  },
  light: {
    fog: 0xf3f3f1,
    ground: 0xe6e6e4,
    hemiSky: 0xffffff,
    hemiGround: 0xc8c8d0,
    hemiIntensity: 2.1,
    keyIntensity: 2.4,
    fillIntensity: 1.5,
    exposure: 1.25,
  },
} as const;

/** Se lanza si el navegador no puede crear un contexto WebGL. */
export class WebGLUnavailableError extends Error {}

/**
 * Renderer, escena raíz, luces base y bucle de render. Aquí no vive nada del
 * narrativo: es fontanería de Three.js para que los componentes no toquen WebGL.
 */
@Injectable({ providedIn: 'root' })
export class ThreeSceneService implements OnDestroy {
  readonly scene = new THREE.Scene();
  renderer!: THREE.WebGLRenderer;

  private frameId = 0;
  private canvas?: HTMLCanvasElement;
  private clock = new THREE.Clock();
  private updateCallbacks: Array<(delta: number, elapsed: number) => void> = [];
  private isMobile = false;

  /** Guardadas solo para repintarlas al cambiar de tema. */
  private ground?: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  private hemi?: THREE.HemisphereLight;
  private key?: THREE.DirectionalLight;
  private fill?: THREE.DirectionalLight;
  private rim?: THREE.PointLight;
  private themeName: 'dark' | 'light' = 'dark';

  constructor(private zone: NgZone) {}

  mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.isMobile = window.innerWidth < 768;

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: !this.isMobile,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch (err) {
      throw new WebGLUnavailableError(String(err));
    }

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1.5 : 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.shadowMap.enabled = !this.isMobile;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.scene.fog = new THREE.FogExp2(THEMES[this.themeName].fog, this.isMobile ? 0.03 : 0.018);
    this.setupBaseLighting();
    // El tema puede pedirse antes de montar (AppComponent lo resuelve en el
    // constructor para que no parpadee), así que se reaplica ya con escena.
    this.applyTheme(this.themeName);

    window.addEventListener('resize', this.onResize, { passive: true });
  }

  /**
   * La escena no ve el CSS, así que el tema hay que pasárselo a mano: niebla,
   * suelo y, sobre todo, intensidad de las luces.
   */
  applyTheme(theme: 'dark' | 'light'): void {
    this.themeName = theme;
    const t = THEMES[theme];

    (this.scene.fog as THREE.FogExp2 | null)?.color.setHex(t.fog);

    if (this.hemi) {
      this.hemi.color.setHex(t.hemiSky);
      this.hemi.groundColor.setHex(t.hemiGround);
      this.hemi.intensity = t.hemiIntensity;
    }
    if (this.key) this.key.intensity = t.keyIntensity;
    if (this.fill) this.fill.intensity = t.fillIntensity;
    if (this.renderer) this.renderer.toneMappingExposure = t.exposure;

    this.rim?.color.setHex(cssColorHex('--accent', 0x6e7bff));

    if (this.ground) {
      this.ground.material.color.setHex(t.ground);
      // En claro el suelo se apaga: iluminado sobre fondo casi blanco deja una
      // línea de horizonte y una sombra despegada de los pies.
      this.ground.visible = theme === 'dark';
    }
  }

  /** Retiñe la luz de contra cuando cambia el acento. */
  setAccent(hex: number): void {
    this.rim?.color.setHex(hex);
  }

  /** Registra un callback por frame (mixer, balanceo del personaje…). */
  onUpdate(cb: (delta: number, elapsed: number) => void): void {
    this.updateCallbacks.push(cb);
  }

  /**
   * Compila shaders y sube texturas a la GPU antes del primer render.
   *
   * Sin esto, el primer frame que muestra un material nuevo compila su shader
   * en mitad del bucle y produce un tirón — justo al descubrir la escena, que
   * es el peor momento posible. Aquí ese coste se paga con la pantalla de
   * carga todavía puesta.
   */
  async precompile(camera: THREE.Camera): Promise<void> {
    if (!this.renderer) return;
    await this.renderer.compileAsync(this.scene, camera);
  }

  startLoop(camera: THREE.Camera): void {
    this.zone.runOutsideAngular(() => {
      const loop = () => {
        this.frameId = requestAnimationFrame(loop);
        const delta = Math.min(this.clock.getDelta(), 0.05);
        const elapsed = this.clock.getElapsedTime();
        for (const cb of this.updateCallbacks) cb(delta, elapsed);
        this.renderer.render(this.scene, camera);
      };
      loop();
    });
  }

  get mobile(): boolean {
    return this.isMobile;
  }

  private setupBaseLighting(): void {
    const hemi = new THREE.HemisphereLight(THEMES.dark.hemiSky, THEMES.dark.hemiGround, THEMES.dark.hemiIntensity);
    this.hemi = hemi;
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, THEMES.dark.keyIntensity);
    key.position.set(3.5, 5, 4);
    key.castShadow = !this.isMobile;
    if (key.castShadow) {
      // Frustum ajustado al personaje (en vez de los ±5 por defecto): con la
      // resolución fija del shadow map, uno suelto reparte pocos texels por
      // superficie y es lo que producía bandas en la geometría curva.
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.left = -3;
      key.shadow.camera.right = 3;
      key.shadow.camera.top = 3;
      key.shadow.camera.bottom = -3;
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 12;
      // normalBias corrige el acné en mallas curvas mucho mejor que el bias de
      // profundidad solo, que era lo que dejaba el moiré.
      key.shadow.bias = -0.0001;
      key.shadow.normalBias = 0.04;
    }
    this.key = key;
    this.scene.add(key);

    // Relleno desde el lado de la cámara, sin sombras. Es la luz que evita que
    // el personaje se lea como una silueta negra recortada sobre el fondo claro.
    const fill = new THREE.DirectionalLight(0xffffff, THEMES.dark.fillIntensity);
    fill.position.set(-2.5, 2.2, 6);
    this.fill = fill;
    this.scene.add(fill);

    const rim = new THREE.PointLight(cssColorHex('--accent', 0x6e7bff), 6, 12, 2);
    rim.position.set(-3, 2.4, -2.5);
    this.rim = rim;
    this.scene.add(rim);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ color: THEMES.dark.ground, roughness: 0.95, metalness: 0.05 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = !this.isMobile;
    ground.position.y = -1.02;
    this.ground = ground;
    this.scene.add(ground);
  }

  private onResize = (): void => {
    if (!this.canvas) return;
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
  };

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.onResize);
    this.renderer?.dispose();
  }
}
