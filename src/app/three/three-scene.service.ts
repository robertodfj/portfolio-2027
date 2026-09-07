import { Injectable, NgZone, OnDestroy } from '@angular/core';
import * as THREE from 'three';

/**
 * Equivalentes 3D de --stage de cada tema (ver styles.scss). La niebla debe
 * ir al MISMO color que el fondo de la página: es lo que hace que lo lejano
 * se disuelva en él en vez de recortarse contra él.
 */
const THEME_COLORS = {
  dark: { fog: 0x08080a, ground: 0x0a0a0d, hemiGround: 0x0a0a0c },
  light: { fog: 0xf3f3f1, ground: 0xe6e6e4, hemiGround: 0xd8d8dd },
} as const;

/**
 * Owns the renderer, the root scene, base lighting and the render loop.
 * Nothing narrative lives here — this is pure Three.js plumbing so that
 * components never touch WebGL directly.
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
  /** Referencias guardadas solo para poder repintarlas al cambiar de tema. */
  private ground?: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  private hemi?: THREE.HemisphereLight;
  private themeName: 'dark' | 'light' = 'dark';

  constructor(private zone: NgZone) {}

  mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.isMobile = window.innerWidth < 768;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !this.isMobile,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1.5 : 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.shadowMap.enabled = !this.isMobile;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene.fog = new THREE.FogExp2(THEME_COLORS[this.themeName].fog, this.isMobile ? 0.03 : 0.018);
    this.setupBaseLighting();
    // El tema puede haberse pedido ANTES de montar (AppComponent lo resuelve
    // en el constructor, para que no parpadee), así que se reaplica aquí ya
    // con la escena construida.
    this.applyTheme(this.themeName);

    window.addEventListener('resize', this.onResize, { passive: true });
  }

  /**
   * La escena 3D no ve el CSS, así que el tema hay que pasárselo a mano. Solo
   * hacen falta dos cosas: la NIEBLA (si se queda en negro sobre fondo claro,
   * todo lo lejano se ensucia con un halo oscuro que delata el truco) y el
   * plano de suelo. Los modelos no se tocan: una figura oscura sobre fondo
   * claro se lee perfectamente, como un bodegón de producto.
   *
   * Se puede llamar antes de `mount()`: se queda anotado y se aplica al montar.
   */
  applyTheme(theme: 'dark' | 'light'): void {
    this.themeName = theme;
    const palette = THEME_COLORS[theme];
    (this.scene.fog as THREE.FogExp2 | null)?.color.setHex(palette.fog);
    this.hemi?.groundColor.setHex(palette.hemiGround);

    if (this.ground) {
      this.ground.material.color.setHex(palette.ground);
      /*
       * En claro el suelo se APAGA. En oscuro pasa desapercibido porque su
       * color coincide con el fondo de la página, pero iluminado sobre un
       * fondo casi blanco deja de coincidir: aparece una línea de horizonte
       * a media pantalla y una sombra azulada despegada de los pies (el plano
       * está en y = -1.02, un metro por debajo de ellos).
       *
       * Quitarlo no cuesta nada: la escena ya se apoyaba en su propia
       * geometría, no en este plano.
       */
      this.ground.visible = theme === 'dark';
    }
  }

  /** Register a per-frame callback (e.g. AnimationMixer.update, character idle sway). */
  onUpdate(cb: (delta: number, elapsed: number) => void): void {
    this.updateCallbacks.push(cb);
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
    const hemi = new THREE.HemisphereLight(0x9aa5ff, THEME_COLORS.dark.hemiGround, 0.55);
    this.hemi = hemi;
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(3.5, 5, 4);
    key.castShadow = !this.isMobile;
    if (key.castShadow) {
      key.shadow.mapSize.set(2048, 2048);
      // Frustum tightened around the character (rather than the default
      // ±5 units) so the fixed shadow-map resolution lands more texels per
      // surface unit — a loose frustum was the main cause of the banding
      // "stripes" visible on curved skinned geometry in-browser (viewers
      // that don't do real-time self-shadowing never showed the artifact).
      key.shadow.camera.left = -3;
      key.shadow.camera.right = 3;
      key.shadow.camera.top = 3;
      key.shadow.camera.bottom = -3;
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 12;
      // normalBias (offsets the shadow lookup along the surface normal)
      // fixes acne on curved/skinned meshes far more reliably than depth
      // bias alone, which is what was producing the moiré-like stripes.
      key.shadow.bias = -0.0001;
      key.shadow.normalBias = 0.04;
    }
    this.scene.add(key);

    const rim = new THREE.PointLight(0x6e7bff, 6, 12, 2);
    rim.position.set(-3, 2.4, -2.5);
    this.scene.add(rim);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ color: THEME_COLORS.dark.ground, roughness: 0.95, metalness: 0.05 }),
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
