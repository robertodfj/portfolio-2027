import { Injectable, effect, inject } from '@angular/core';
import * as THREE from 'three';
import { CameraService } from './camera.service';
import { AnimationLayer, CharacterController, ModelLoaderService } from './model-loader.service';
import { ScrollProgressService } from './scroll-progress.service';
import { ThreeSceneService } from './three-scene.service';
import {
  createDeskSample,
  createTimelineSample,
  DeskContext,
  DeskSample,
  evaluateDesk,
  evaluateTimeline,
  motorbikePresence,
  TimelineContext,
  TimelineSample,
} from './character-timeline';
import { MotorbikeProp } from './motorbike-prop';
import { buildMotorcycleRider } from './motorcycle-rider';
import { buildDeskSetup, DeskSetup } from './desk-setup';
import { buildParticleField } from './scene-props';
import { PointerInteractionService } from './pointer-interaction.service';
import { AMBIENT, DESK, MOTORBIKE, RIDER } from './narrative.config';
import { AccentService } from '../shared/accent.service';
import { SceneHintsService } from '../shared/scene-hints.service';
import { DEFAULT_CODE } from '../shared/tech-catalog';
import { hexToCss, prefersReducedMotion } from '../shared/browser.util';

const ABOUT_SECTION = 'about';
/** De #experience cuelgan la salida de la moto y la llegada a la mesa. */
const EXPERIENCE_SECTION = 'experience';
/** Anclas 2ª y 3ª de la ruta de cámara del escritorio. */
const TECH_SECTION = 'technologies';
const CONTACT_SECTION = 'contact';

/**
 * Orquestador del narrativo: la única pieza que conoce a la vez el scroll, el
 * timeline y la escena.
 *
 *   ScrollProgressService  ->  progress ∈ [0,1]
 *   character-timeline     ->  mezcla, posición y cámara (funciones puras)
 *   CharacterController    ->  pesos del AnimationMixer
 *   ThreeSceneService      ->  un único requestAnimationFrame
 */
@Injectable({ providedIn: 'root' })
export class AnimationService {
  private readonly pointer = inject(PointerInteractionService);
  private readonly accent = inject(AccentService);
  private readonly hints = inject(SceneHintsService);

  private character?: CharacterController;
  private particles?: THREE.Points;
  private motorbike?: MotorbikeProp;
  private desk?: DeskSetup;

  /**
   * Sin clip de reposo la suma de pesos caería a 0 y el mixer devolvería la
   * T-pose. Si falta el Idle, Walking se queda a peso 1 y su primer fotograma
   * hace de reposo.
   */
  private idleAvailable = true;

  /** Muestras reutilizadas cada frame: cero asignaciones en el bucle. */
  private readonly sample: TimelineSample = createTimelineSample();
  private readonly deskSample: DeskSample = createDeskSample();
  private readonly camOffset = new THREE.Vector3();
  private readonly context: TimelineContext = { aboutTop: 0, visibleHalfWidth: 0 };
  private readonly deskContext: DeskContext = {
    sectionTop: 0,
    enterLeadProgress: 0,
    enterSpanProgress: 0,
    techTop: 0,
    contactTop: 0,
  };

  /** Vectores de trabajo del brillo de la tira LED. */
  private readonly ledWorld = new THREE.Vector3();

  private cursorIsPointer = false;
  private themeName: 'dark' | 'light' = 'dark';
  /**
   * Movimiento reducido pedido por el sistema. Solo apaga lo que se mueve SOLO
   * —giro de la moto, deriva de las partículas, parpadeo de la pantalla—, que
   * es lo que provoca mareo. El recorrido por scroll se mantiene: lo controla
   * el usuario con su propio gesto, y es el contenido de la página.
   */
  private readonly reduced = prefersReducedMotion();

  private readonly layers: AnimationLayer[] = [
    { state: 'Idle', weight: 1 },
    { state: 'Walking', weight: 0, phase: 0 },
    // Sin `phase`: corre libre con el reloj, como el Idle.
    { state: 'Typing', weight: 0 },
  ];

  constructor(
    private scene: ThreeSceneService,
    private cameraSvc: CameraService,
    private scroll: ScrollProgressService,
    private modelLoader: ModelLoaderService,
  ) {
    // Elegir una tecnología retiñe la escena y cambia el código de la pantalla.
    effect(() => {
      const hex = this.accent.accentHex();
      const tech = this.accent.selectedTech();

      this.desk?.setAccent(hex);
      this.desk?.screen.setAccent(hexToCss(hex));
      this.desk?.screen.setCode(tech?.code ?? DEFAULT_CODE);
      this.applyParticleColor();
    });
  }

  init(character: CharacterController, scrollHost: HTMLElement): void {
    this.character = character;
    this.scene.scene.add(character.root);

    this.particles = buildParticleField(
      this.scene.mobile ? AMBIENT.PARTICLES_MOBILE : AMBIENT.PARTICLES_DESKTOP,
    );
    this.applyParticleColor();
    this.scene.scene.add(this.particles);

    // El mueble se monta exactamente sobre el asiento, en el espacio local del
    // personaje, para que no puedan descolocarse entre sí.
    this.desk = buildDeskSetup(this.scene.renderer);
    this.desk.group.position.copy(DESK.SEAT);
    this.desk.group.scale.setScalar(DESK.SCENE_SCALE);
    this.desk.group.rotation.y = DESK.SEAT_ROT_Y;
    this.desk.group.visible = false;
    this.desk.screen.setCode(DEFAULT_CODE);
    this.desk.screen.setAccent(hexToCss(this.accent.accentHex()));
    this.desk.setAccent(this.accent.accentHex());
    this.scene.scene.add(this.desk.group);

    this.idleAvailable = character.availableStates.has('Idle');
    this.warnAboutMissingClips(character);

    this.scroll.attach(scrollHost);
    this.scroll.trackSection(ABOUT_SECTION, MOTORBIKE.SECTION_SELECTOR);
    this.scroll.trackSection(EXPERIENCE_SECTION, MOTORBIKE.EXIT_SECTION_SELECTOR);
    this.scroll.trackSection(TECH_SECTION, DESK.TECH_SECTION_SELECTOR);
    this.scroll.trackSection(CONTACT_SECTION, DESK.CONTACT_SECTION_SELECTOR);
    this.scene.onUpdate(this.tick);

    // Primer frame determinista: nada de salto inicial.
    this.apply(this.scroll.raw);
  }

  refresh(): void {
    this.scroll.refresh();
  }

  /**
   * Resuelve cuando lo que se ve en el PRIMER encuadre está listo: por ahora,
   * los shaders compilados. Evita el tirón del primer frame y cuesta
   * milisegundos, no megabytes.
   */
  async whenReady(): Promise<void> {
    await this.scene.precompile(this.cameraSvc.camera);
  }

  /**
   * Arranca los props que no se ven de entrada. Se llama DESPUÉS de descubrir
   * la escena, y no antes, por dos razones:
   *
   *  - la moto pesa 5 MB y no aparece hasta una pantalla más abajo, así que
   *    tiene todo el hero de margen para llegar;
   *  - descomprimir ese Draco bloquea el hilo principal. Cargándola durante la
   *    espera, el velo no se podía ni retirar hasta que terminaba: medido, se
   *    iba siempre 0,4 s después de recibirla, a 30 y a 6 Mbps.
   */
  loadDeferredProps(): Promise<void> {
    return this.loadMotorbike().catch((err) => {
      console.warn('[AnimationService] La moto no pudo montarse.', err);
    });
  }

  applyTheme(theme: 'dark' | 'light'): void {
    this.themeName = theme;
    this.applyParticleColor();
  }

  /**
   * En oscuro las partículas son puntos de acento; en claro ese mismo índigo
   * al 50 % se lee como suciedad, así que se oscurecen y bajan de opacidad.
   */
  private applyParticleColor(): void {
    const material = this.particles?.material as THREE.PointsMaterial | undefined;
    if (!material) return;

    const accent = new THREE.Color(this.accent.accentHex());
    if (this.themeName === 'light') accent.multiplyScalar(0.45);
    material.color.copy(accent);
    material.opacity = this.themeName === 'dark' ? 0.5 : 0.22;
  }

  /** Único punto de entrada por frame. El reloj manda el tiempo; el scroll, el contenido. */
  private tick = (delta: number, elapsed: number): void => {
    const progress = this.scroll.sample(delta);
    this.apply(progress);

    // El mixer avanza con tiempo real, pero Walking tiene timeScale 0: su
    // cabezal es solo el que ha escrito `apply`.
    this.character?.update(delta, elapsed);

    this.updateMotorbike(progress, delta);
    this.updateDeskEffects(elapsed);

    if (this.particles && !this.reduced) {
      this.particles.rotation.y = elapsed * AMBIENT.PARTICLE_SPIN;
    }

    this.cameraSvc.update();
  };

  private updateMotorbike(progress: number, delta: number): void {
    const motorbike = this.motorbike;
    if (!motorbike) return;

    const nextRange = this.scroll.sectionRange(EXPERIENCE_SECTION);
    motorbike.setPresence(
      nextRange
        ? motorbikePresence(
            progress,
            this.sample,
            nextRange,
            this.scroll.vhToProgress(MOTORBIKE.EXIT_LEAD_VH),
            this.scroll.vhToProgress(MOTORBIKE.EXIT_FADE_VH),
          )
        : 0,
    );
    motorbike.setPlacement(
      this.cameraSvc.camera.position.x,
      this.cameraSvc.visibleHalfWidth,
      this.scene.mobile ? MOTORBIKE.SCREEN_X_MOBILE : MOTORBIKE.SCREEN_X,
    );

    // Three.js recalcula matrixWorld dentro de render(), que corre después de
    // este callback: sin esto el rayo iría un frame por detrás.
    motorbike.root.updateMatrixWorld(true);
    this.cameraSvc.camera.updateMatrixWorld(true);

    const hovered = motorbike.updatePointer(this.pointer.ndc, this.cameraSvc.camera);
    if (hovered) this.hints.markBikeFound();

    motorbike.update(delta);
    this.setCursorPointer(hovered);
  }

  /** Parpadeo de la pantalla y tira LED que responde al puntero. */
  private updateDeskEffects(elapsed: number): void {
    const desk = this.desk;
    if (!desk || !desk.group.visible) return;

    if (!this.reduced) {
      // Dos senos desfasados: no repite de forma audible y evita el pulso
      // regular que delataría una animación.
      const flicker =
        1 + Math.sin(elapsed * 11.3) * 0.035 + Math.sin(elapsed * 3.7) * 0.02;
      desk.screenLight.intensity = 3 * flicker;
    }

    // La tira LED brilla más cuanto más cerca está el puntero, en pantalla.
    desk.led.getWorldPosition(this.ledWorld).project(this.cameraSvc.camera);
    const dx = this.ledWorld.x - this.pointer.ndc.x;
    const dy = this.ledWorld.y - this.pointer.ndc.y;
    const proximity = Math.max(0, 1 - Math.hypot(dx, dy) / 1.1);
    (desk.led.material as THREE.MeshStandardMaterial).emissiveIntensity =
      1.7 + proximity * proximity * 2.6;
  }

  private setCursorPointer(pointer: boolean): void {
    if (pointer === this.cursorIsPointer) return;
    this.cursorIsPointer = pointer;
    document.body.style.cursor = pointer ? 'pointer' : '';
  }

  private async loadMotorbike(): Promise<void> {
    const [motorbikeScene, riderScene] = await Promise.all([
      this.modelLoader.loadProp(MOTORBIKE.PATH),
      this.modelLoader.loadProp(RIDER.PATH),
    ]);
    if (!motorbikeScene) return;

    this.motorbike = new MotorbikeProp(motorbikeScene, this.scene.renderer);

    // El jinete depende de que el GLB traiga los huesos de Mixamo con sus
    // nombres. Si no los trae, se monta la moto sola en vez de perderla entera.
    if (riderScene) {
      try {
        this.motorbike.attachRider(buildMotorcycleRider(riderScene));
      } catch (err) {
        console.warn('[AnimationService] No se pudo posar al jinete sobre la moto.', err);
      }
    }

    this.scene.scene.add(this.motorbike.root);
  }

  /** progress -> estado de la escena. Determinista, sin memoria. */
  private apply(progress: number): void {
    this.context.aboutTop = this.scroll.sectionRange(ABOUT_SECTION)?.top ?? 0;
    this.context.visibleHalfWidth = this.cameraSvc.visibleHalfWidth;

    const s = evaluateTimeline(progress, this.context, this.sample);

    this.deskContext.sectionTop = this.scroll.sectionRange(EXPERIENCE_SECTION)?.top ?? 0;
    this.deskContext.enterLeadProgress = this.scroll.vhToProgress(DESK.ENTER_LEAD_VH);
    this.deskContext.enterSpanProgress = this.scroll.vhToProgress(DESK.ENTER_SPAN_VH);
    this.deskContext.techTop = this.scroll.sectionRange(TECH_SECTION)?.top ?? 0;
    this.deskContext.contactTop = this.scroll.sectionRange(CONTACT_SECTION)?.top ?? 0;
    const d = evaluateDesk(progress, this.deskContext, s.cameraPosition, s.cameraLookAt, this.deskSample);

    if (this.desk) {
      this.desk.group.visible = d.active;
      // Personaje y mueble pivotan sobre el mismo punto, así que giran rígidos
      // y la pose sigue encajando.
      this.desk.group.rotation.y = DESK.SEAT_ROT_Y + d.setupYaw;
      // El código se escribe mientras teclea, no antes.
      this.desk.screen.setProgress(d.typingBlend > 0 ? d.typingProgress : 0);
    }

    if (this.character) {
      if (d.active) {
        this.character.root.position.copy(d.position);
        this.character.root.rotation.y = d.rotationY;
        this.character.root.scale.setScalar(d.scale);

        this.layers[0].weight = 0;
        this.layers[1].weight = d.walkBlend;
        this.layers[1].phase = d.walkPhase;
        this.layers[2].weight = d.typingBlend;
      } else {
        this.character.root.position.copy(s.position);
        this.character.root.rotation.y = s.rotationY;
        this.character.root.scale.setScalar(1);

        this.layers[0].weight = this.idleAvailable ? 1 - s.walkBlend : 0;
        this.layers[1].weight = this.idleAvailable ? s.walkBlend : 1;
        this.layers[1].phase = s.walkPhase;
        this.layers[2].weight = 0;
      }
      this.character.applyLayers(this.layers);
    }

    this.placeCamera(
      d.active ? d.cameraPosition : s.cameraPosition,
      d.active ? d.cameraLookAt : s.cameraLookAt,
      d.active,
    );
  }

  /**
   * La cámara se aleja por su eje de visión lo justo para que el encuadre
   * quepa en el aspecto actual. Escalar el offset (y no la posición) conserva
   * el encuadre que decidió el timeline.
   */
  private placeCamera(camPos: THREE.Vector3, camLook: THREE.Vector3, deskActive: boolean): void {
    // En móvil el texto ocupa todo el ancho, así que la escena se corre hacia
    // el borde derecho para no taparlo.
    const shiftX = deskActive && this.scene.mobile ? DESK.MOBILE_CAMERA_SHIFT_X : 0;
    this.cameraSvc.lookTarget.set(camLook.x + shiftX, camLook.y, camLook.z);
    this.cameraSvc.camera.position
      .copy(this.cameraSvc.lookTarget)
      .addScaledVector(
        this.camOffset.set(camPos.x - camLook.x, camPos.y - camLook.y, camPos.z - camLook.z),
        this.cameraSvc.distanceScale,
      );
  }

  private warnAboutMissingClips(character: CharacterController): void {
    const missing = this.layers.map((l) => l.state).filter((s) => !character.availableStates.has(s));
    if (!missing.length) return;

    if (!character.availableStates.has('Walking')) {
      console.warn(
        `[AnimationService] Faltan los clips ${missing.join(', ')}. Reexporta el GLB con "Idle" y "Walking".`,
      );
      return;
    }

    console.warn(
      `[AnimationService] Falta el clip ${missing.join(', ')}. Walking queda a peso 1 para no caer a la bind pose.`,
    );
  }

  dispose(): void {
    this.scroll.dispose();
    this.motorbike?.dispose();
    this.desk?.dispose();
    this.character?.dispose();

    if (this.particles) {
      this.particles.geometry.dispose();
      (this.particles.material as THREE.Material).dispose();
    }

    this.setCursorPointer(false);
  }
}
