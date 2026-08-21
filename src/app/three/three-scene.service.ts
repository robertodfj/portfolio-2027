import { Injectable, NgZone, OnDestroy } from '@angular/core';
import * as THREE from 'three';

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

    this.scene.fog = new THREE.FogExp2(0x08080a, this.isMobile ? 0.03 : 0.018);
    this.setupBaseLighting();

    window.addEventListener('resize', this.onResize, { passive: true });
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
    const hemi = new THREE.HemisphereLight(0x9aa5ff, 0x0a0a0c, 0.55);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(3.5, 5, 4);
    key.castShadow = !this.isMobile;
    if (key.castShadow) {
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 20;
      key.shadow.bias = -0.0025;
    }
    this.scene.add(key);

    const rim = new THREE.PointLight(0x6e7bff, 6, 12, 2);
    rim.position.set(-3, 2.4, -2.5);
    this.scene.add(rim);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0d, roughness: 0.95, metalness: 0.05 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = !this.isMobile;
    ground.position.y = -1.02;
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
