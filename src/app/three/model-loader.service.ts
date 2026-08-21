import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/** Every scene stage in the scroll narrative maps to one of these states. */
export type CharacterState =
  | 'Idle'
  | 'Walking'
  | 'Typing'
  | 'Looking'
  | 'Standing'
  | 'Motorcycle';

/**
 * Common surface both the real GLB-driven character and the procedural
 * placeholder implement, so every consumer (AnimationService) is written
 * once and never has to know which one is active.
 */
export interface CharacterController {
  readonly root: THREE.Group;
  readonly usingPlaceholder: boolean;
  play(state: CharacterState, opts?: { crossfade?: number; loop?: boolean }): void;
  update(delta: number, elapsed: number): void;
  dispose(): void;
}

const CLIP_ALIASES: Record<CharacterState, string[]> = {
  Idle: ['idle', 'breathing', 'stand_idle'],
  Walking: ['walk', 'walking', 'run'],
  Typing: ['typ', 'keyboard', 'work'],
  Looking: ['look', 'turn', 'greet'],
  Standing: ['standing', 'stand', 'pose', 'presentation'],
  Motorcycle: ['motor', 'bike', 'ride'],
};

@Injectable({ providedIn: 'root' })
export class ModelLoaderService {
  private readonly loader = new GLTFLoader();

  constructor() {
    // Optional Draco support for compressed export pipelines — safe no-op
    // if the GLB isn't Draco-compressed.
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    this.loader.setDRACOLoader(draco);
  }

  /**
   * Loads /assets/models/roberto.glb. If the file is missing or fails to
   * parse, resolves with a procedural placeholder instead of rejecting —
   * the site must never break just because the final model isn't in yet.
   */
  async loadCharacter(path = 'assets/models/roberto.glb'): Promise<CharacterController> {
    try {
      const gltf = await this.loader.loadAsync(path);
      return new GltfCharacter(gltf);
    } catch {
      console.warn(
        `[ModelLoaderService] No se pudo cargar "${path}". Usando personaje placeholder. ` +
          'Sustituye el archivo por tu modelo definitivo para activar el GLB real.',
      );
      return new PlaceholderCharacter();
    }
  }
}

/** Real GLB path: wraps GLTF scene graph + AnimationMixer + clip lookup. */
class GltfCharacter implements CharacterController {
  readonly root: THREE.Group;
  readonly usingPlaceholder = false;
  private mixer: THREE.AnimationMixer;
  private clips = new Map<CharacterState, THREE.AnimationClip>();
  private currentAction: THREE.AnimationAction | null = null;

  constructor(gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) {
    this.root = gltf.scene;
    this.root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    this.mixer = new THREE.AnimationMixer(this.root);
    this.mapClips(gltf.animations);
  }

  private mapClips(clips: THREE.AnimationClip[]): void {
    for (const [state, aliases] of Object.entries(CLIP_ALIASES) as [CharacterState, string[]][]) {
      const match = clips.find((c) => aliases.some((a) => c.name.toLowerCase().includes(a)));
      if (match) this.clips.set(state, match);
    }
    // Fallback: if nothing matched by name, just use whatever clips exist in order.
    if (this.clips.size === 0 && clips.length) {
      (Object.keys(CLIP_ALIASES) as CharacterState[]).forEach((state, i) => {
        if (clips[i]) this.clips.set(state, clips[i]);
      });
    }
  }

  play(state: CharacterState, opts: { crossfade?: number; loop?: boolean } = {}): void {
    const clip = this.clips.get(state);
    if (!clip) return;
    const nextAction = this.mixer.clipAction(clip);
    nextAction.reset();
    nextAction.setLoop(opts.loop === false ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    nextAction.clampWhenFinished = opts.loop === false;
    nextAction.enabled = true;
    nextAction.fadeIn(opts.crossfade ?? 0.4);
    this.currentAction?.fadeOut(opts.crossfade ?? 0.4);
    nextAction.play();
    this.currentAction = nextAction;
  }

  update(delta: number): void {
    this.mixer.update(delta);
  }

  dispose(): void {
    this.mixer.stopAllAction();
  }
}

/**
 * Low-poly procedural stand-in so the full experience is reviewable before
 * the definitive GLB exists. Implements the exact same play()/update() API,
 * so dropping roberto.glb into /assets/models later requires no code
 * changes — ModelLoaderService will pick it up automatically.
 */
class PlaceholderCharacter implements CharacterController {
  readonly root = new THREE.Group();
  readonly usingPlaceholder = true;

  private head!: THREE.Mesh;
  private torso!: THREE.Mesh;
  private armL!: THREE.Group;
  private armR!: THREE.Group;
  private legL!: THREE.Group;
  private legR!: THREE.Group;

  private state: CharacterState = 'Idle';

  constructor() {
    this.build();
  }

  private build(): void {
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a1a1f, roughness: 0.55, metalness: 0.25 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x6e7bff, roughness: 0.35, metalness: 0.4 });

    this.torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.55, 4, 12), mat);
    this.torso.position.y = 1.05;
    this.torso.castShadow = true;

    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 20), mat);
    this.head.position.y = 1.62;
    this.head.castShadow = true;

    const visor = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 8, 24), accentMat);
    visor.position.set(0, 1.6, 0.17);
    visor.rotation.x = Math.PI / 2;

    this.armL = this.buildLimb(0.09, 0.5, mat, accentMat);
    this.armL.position.set(-0.34, 1.32, 0);
    this.armR = this.buildLimb(0.09, 0.5, mat, accentMat);
    this.armR.position.set(0.34, 1.32, 0);

    this.legL = this.buildLimb(0.11, 0.62, mat, accentMat);
    this.legL.position.set(-0.14, 0.62, 0);
    this.legR = this.buildLimb(0.11, 0.62, mat, accentMat);
    this.legR.position.set(0.14, 0.62, 0);

    this.root.add(this.torso, this.head, visor, this.armL, this.armR, this.legL, this.legR);
    this.root.traverse((o) => (o.castShadow = true));
  }

  private buildLimb(radius: number, length: number, mat: THREE.Material, tipMat: THREE.Material): THREE.Group {
    const g = new THREE.Group();
    const bone = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 8), mat);
    bone.position.y = -length / 2 - radius;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.9, 12, 12), tipMat);
    tip.position.y = -length - radius * 2;
    g.add(bone, tip);
    return g;
  }

  play(state: CharacterState): void {
    this.state = state;
  }

  update(_delta: number, elapsed: number): void {
    const t = elapsed;
    // Every state is a small hand-authored procedural loop — cheap, but
    // distinct enough per section to sell the narrative until the GLB lands.
    switch (this.state) {
      case 'Walking':
        this.armL.rotation.x = Math.sin(t * 6) * 0.6;
        this.armR.rotation.x = -Math.sin(t * 6) * 0.6;
        this.legL.rotation.x = -Math.sin(t * 6) * 0.6;
        this.legR.rotation.x = Math.sin(t * 6) * 0.6;
        this.root.position.y = Math.abs(Math.sin(t * 6)) * 0.03;
        break;
      case 'Typing':
        this.armL.rotation.x = -1.15 + Math.sin(t * 14) * 0.05;
        this.armR.rotation.x = -1.15 + Math.cos(t * 14) * 0.05;
        this.head.rotation.x = 0.25;
        this.resetLegs();
        break;
      case 'Looking':
        this.head.rotation.y = Math.sin(t * 1.4) * 0.35;
        this.resetLimbs();
        break;
      case 'Motorcycle':
        this.armL.rotation.x = -0.9;
        this.armR.rotation.x = -0.9;
        this.legL.rotation.x = -0.6;
        this.legR.rotation.x = -0.6;
        this.torso.rotation.x = 0.15;
        break;
      case 'Standing':
        this.resetLimbs();
        this.torso.rotation.z = Math.sin(t * 0.5) * 0.02;
        break;
      case 'Idle':
      default:
        this.resetLimbs();
        this.torso.position.y = 1.05 + Math.sin(t * 1.6) * 0.01;
        this.head.rotation.y = Math.sin(t * 0.6) * 0.08;
        break;
    }
  }

  private resetLimbs(): void {
    this.armL.rotation.x = 0;
    this.armR.rotation.x = 0;
    this.head.rotation.x = 0;
    this.torso.rotation.x = 0;
    this.resetLegs();
  }

  private resetLegs(): void {
    this.legL.rotation.x = 0;
    this.legR.rotation.x = 0;
  }

  dispose(): void {
    this.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m.dispose());
      }
    });
  }
}
