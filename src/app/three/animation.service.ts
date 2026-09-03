import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { CameraService } from './camera.service';
import { AnimationLayer, CharacterController, ModelLoaderService } from './model-loader.service';
import { ScrollProgressService } from './scroll-progress.service';
import { ThreeSceneService } from './three-scene.service';
import {
  createTimelineSample,
  evaluateTimeline,
  motorbikePresence,
  TimelineContext,
  TimelineSample,
} from './character-timeline';
import { MotorbikeProp } from './motorbike-prop';
import { buildParticleField } from './scene-props';
import { AMBIENT, MOTORBIKE } from './narrative.config';

/** Clave con la que se sigue el tramo de "Más allá del código". */
const ABOUT_SECTION = 'about';

/**
 * Orquestador del narrativo. Es la única pieza que conoce a la vez el scroll,
 * el timeline y la escena; el resto son módulos que no saben unos de otros.
 *
 *   ScrollProgressService  ->  scrollProgress ∈ [0,1]
 *   character-timeline     ->  blend / fase de clip / posición / cámara
 *   CharacterController    ->  pesos y cabezales del AnimationMixer
 *   ThreeSceneService      ->  render loop (un único requestAnimationFrame)
 *
 * FASE 1 implementada: Idle -> caminar hacia la izquierda -> Idle, íntegramente
 * scrubbed por scroll y perfectamente reversible. Las etapas posteriores
 * (escritorio, typing, moto, proyectos, contacto) todavía no existen.
 */
@Injectable({ providedIn: 'root' })
export class AnimationService {
  private character?: CharacterController;
  private particles?: THREE.Points;
  private motorbike?: MotorbikeProp;

  /**
   * Sin clip de reposo no hay nada con lo que mezclar: la suma de pesos
   * caería a 0 y el mixer devolvería la bind pose (T-pose). Mientras falte
   * el Idle, Walking se queda a peso 1 y su primer fotograma hace de reposo.
   * En cuanto el GLB traiga un Idle, esto se desactiva solo.
   */
  private idleAvailable = true;

  /** Muestra reutilizada cada frame — cero asignaciones en el bucle. */
  private readonly sample: TimelineSample = createTimelineSample();
  /** Vector de trabajo para el offset de cámara, también reutilizado. */
  private readonly camOffset = new THREE.Vector3();
  /** Contexto medido (layout + encuadre) que el timeline necesita. Reutilizado. */
  private readonly context: TimelineContext = { aboutTop: 0, visibleHalfWidth: 0 };

  /**
   * Array de capas estable: se muta in situ, nunca se recrea, y el
   * CharacterController tampoco recrea acciones a partir de él.
   * Idle corre libre (sin `phase`); Walking va scrubbed por el scroll.
   */
  private readonly layers: AnimationLayer[] = [
    { state: 'Idle', weight: 1 },
    { state: 'Walking', weight: 0, phase: 0 },
  ];

  constructor(
    private scene: ThreeSceneService,
    private cameraSvc: CameraService,
    private scroll: ScrollProgressService,
    private modelLoader: ModelLoaderService,
  ) {}

  init(character: CharacterController, scrollHost: HTMLElement): void {
    this.character = character;
    this.scene.scene.add(character.root);

    this.particles = buildParticleField(
      this.scene.mobile ? AMBIENT.PARTICLES_MOBILE : AMBIENT.PARTICLES_DESKTOP,
    );
    this.scene.scene.add(this.particles);

    this.idleAvailable = character.availableStates.has('Idle');
    this.warnAboutMissingClips(character);

    this.scroll.attach(scrollHost);
    this.scroll.trackSection(ABOUT_SECTION, MOTORBIKE.SECTION_SELECTOR);
    this.scene.onUpdate(this.tick);

    // La moto pesa ~2 MB con 46 texturas: se carga aparte para no retrasar la
    // entrada a la escena, y aparece cuando esté lista.
    void this.loadMotorbike();

    // Primer frame determinista: el personaje ya está colocado y en Idle antes
    // de que el render loop arranque, así que no hay salto inicial.
    this.apply(this.scroll.raw);
  }

  refresh(): void {
    this.scroll.refresh();
  }

  /**
   * Único punto de entrada por frame. El render loop manda el tiempo; el
   * scroll manda el contenido. Nunca al revés.
   */
  private tick = (delta: number, elapsed: number): void => {
    const progress = this.scroll.sample(delta);
    this.apply(progress);

    // El mixer avanza con tiempo real, pero la acción Walking tiene timeScale
    // 0: su cabezal es exclusivamente el que ha escrito `apply`. Solo el Idle
    // aprovecha este delta.
    this.character?.update(delta, elapsed);

    if (this.motorbike) {
      // Presencia <- scroll (reversible). Giro <- reloj (continuo).
      const range = this.scroll.sectionRange(ABOUT_SECTION);
      this.motorbike.setPresence(range ? motorbikePresence(progress, this.sample, range) : 0);
      this.motorbike.setPlacement(this.cameraSvc.camera.position.x, this.cameraSvc.visibleHalfWidth);
      this.motorbike.update(elapsed);
    }

    if (this.particles) this.particles.rotation.y = elapsed * AMBIENT.PARTICLE_SPIN;

    this.cameraSvc.update();
  };

  private async loadMotorbike(): Promise<void> {
    const scene = await this.modelLoader.loadProp(MOTORBIKE.PATH);
    if (!scene) return;
    this.motorbike = new MotorbikeProp(scene, this.scene.renderer);
    this.scene.scene.add(this.motorbike.root);
  }

  /** scrollProgress -> estado de la escena. Función determinista, sin memoria. */
  private apply(progress: number): void {
    // El contexto se refresca desde las medidas vivas: si cambia el layout o
    // el tamaño de la ventana, el punto de salida se recalcula solo.
    this.context.aboutTop = this.scroll.sectionRange(ABOUT_SECTION)?.top ?? 0;
    this.context.visibleHalfWidth = this.cameraSvc.visibleHalfWidth;

    const s = evaluateTimeline(progress, this.context, this.sample);

    if (this.character) {
      this.character.root.position.copy(s.position);
      this.character.root.rotation.y = s.rotationY;

      this.layers[0].weight = this.idleAvailable ? 1 - s.walkBlend : 0;
      this.layers[1].weight = this.idleAvailable ? s.walkBlend : 1;
      this.layers[1].phase = s.walkPhase;
      this.character.applyLayers(this.layers);
    }

    // La cámara se aleja a lo largo de su propio eje de visión lo justo para
    // que el encuadre quepa en el aspecto actual. Escalar el offset (y no la
    // posición) conserva el encuadre que decidió el timeline.
    this.cameraSvc.lookTarget.copy(s.cameraLookAt);
    this.cameraSvc.camera.position
      .copy(s.cameraLookAt)
      .addScaledVector(
        this.camOffset.subVectors(s.cameraPosition, s.cameraLookAt),
        this.cameraSvc.distanceScale,
      );
  }

  private warnAboutMissingClips(character: CharacterController): void {
    const missing = this.layers.map((l) => l.state).filter((s) => !character.availableStates.has(s));
    if (!missing.length) return;

    if (!character.availableStates.has('Walking')) {
      console.warn(
        `[AnimationService] Faltan los clips ${missing.join(', ')}. La fase 1 desplazará al ` +
          'personaje pero no habrá animación que scrubbear. Reexporta el GLB con "Idle" y "Walking".',
      );
      return;
    }

    console.warn(
      `[AnimationService] Falta el clip ${missing.join(', ')}. Walking queda a peso 1 y su ` +
        'primer fotograma hace de reposo, para no caer a la bind pose. Añade un "Idle" al GLB ' +
        'para recuperar la mezcla real de reposo.',
    );
  }

  dispose(): void {
    this.scroll.dispose();
    this.motorbike?.dispose();
  }
}
