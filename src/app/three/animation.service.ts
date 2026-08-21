import { Injectable, NgZone } from '@angular/core';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CameraService } from './camera.service';
import { CharacterController, CharacterState } from './model-loader.service';
import { ThreeSceneService } from './three-scene.service';
import { buildDeskProp, buildMotorcycleProp, buildParticleField } from './scene-props';

gsap.registerPlugin(ScrollTrigger);

interface Keyframe {
  progress: number;
  characterPos: THREE.Vector3;
  characterRotY: number;
  cameraPos: THREE.Vector3;
  lookAt: THREE.Vector3;
  state: CharacterState;
}

/**
 * scrollProgress = 0    -> idle, hero
 * scrollProgress = 0.25 -> walking
 * scrollProgress = 0.40 -> arrives at desk
 * scrollProgress = 0.55 -> programming scene (typing)
 * scrollProgress = 0.70 -> personal / motorcycle
 * scrollProgress = 0.85 -> projects (standing, presenting)
 * scrollProgress = 1.00 -> contact (looking at the user)
 * Values below come straight from the brief's conceptual scroll map.
 */
const KEYFRAMES: Keyframe[] = [
  { progress: 0.0, characterPos: new THREE.Vector3(0, 0, 0.4), characterRotY: 0, cameraPos: new THREE.Vector3(0, 1.35, 5.2), lookAt: new THREE.Vector3(0, 1.0, 0.4), state: 'Idle' },
  { progress: 0.12, characterPos: new THREE.Vector3(0, 0, 0.1), characterRotY: -0.15, cameraPos: new THREE.Vector3(0.6, 1.3, 4.6), lookAt: new THREE.Vector3(0, 1.0, 0.1), state: 'Idle' },
  { progress: 0.25, characterPos: new THREE.Vector3(-0.6, 0, -0.6), characterRotY: -0.35, cameraPos: new THREE.Vector3(0.9, 1.35, 4.0), lookAt: new THREE.Vector3(-0.4, 1.0, -0.4), state: 'Walking' },
  { progress: 0.4, characterPos: new THREE.Vector3(0.55, 0, -0.55), characterRotY: 1.9, cameraPos: new THREE.Vector3(1.5, 1.35, 3.0), lookAt: new THREE.Vector3(0.75, 1.0, -0.6), state: 'Walking' },
  { progress: 0.55, characterPos: new THREE.Vector3(0.55, 0, -0.6), characterRotY: 2.0, cameraPos: new THREE.Vector3(1.7, 1.5, 2.2), lookAt: new THREE.Vector3(0.85, 1.0, -0.75), state: 'Typing' },
  { progress: 0.7, characterPos: new THREE.Vector3(-0.3, 0, -0.3), characterRotY: -1.4, cameraPos: new THREE.Vector3(0.3, 1.15, 2.0), lookAt: new THREE.Vector3(-0.1, 0.8, -0.3), state: 'Motorcycle' },
  { progress: 0.85, characterPos: new THREE.Vector3(0, 0, 0.2), characterRotY: 0.25, cameraPos: new THREE.Vector3(-0.9, 1.3, 3.3), lookAt: new THREE.Vector3(0, 1.0, 0.2), state: 'Standing' },
  { progress: 1.0, characterPos: new THREE.Vector3(0, 0, 0.6), characterRotY: 0, cameraPos: new THREE.Vector3(0, 1.35, 3.4), lookAt: new THREE.Vector3(0, 1.05, 0.6), state: 'Looking' },
];

@Injectable({ providedIn: 'root' })
export class AnimationService {
  private character?: CharacterController;
  private desk?: THREE.Group;
  private motorcycle?: THREE.Group;
  private currentState: CharacterState | null = null;
  private st?: ScrollTrigger;

  constructor(
    private scene: ThreeSceneService,
    private cameraSvc: CameraService,
    private zone: NgZone,
  ) {}

  init(character: CharacterController, scrollHost: HTMLElement): void {
    this.character = character;
    this.scene.scene.add(character.root);

    this.desk = buildDeskProp();
    this.desk.scale.setScalar(0.001);
    this.motorcycle = buildMotorcycleProp();
    this.motorcycle.position.set(-1.1, 0, -0.4);
    this.motorcycle.scale.setScalar(0.001);
    const particles = buildParticleField(this.scene.mobile ? 60 : 140);

    this.scene.scene.add(this.desk, this.motorcycle, particles);

    this.zone.runOutsideAngular(() => {
      this.st = ScrollTrigger.create({
        trigger: scrollHost,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.6, // smooth, non-hijacking scrub — native scroll stays in control
        onUpdate: (self) => this.applyProgress(self.progress),
      });
      // Gentle idle particle drift, independent of scroll.
      gsap.to(particles.rotation, { y: Math.PI * 2, duration: 240, repeat: -1, ease: 'none' });
    });

    this.applyProgress(0);
  }

  refresh(): void {
    this.st?.refresh();
  }

  private applyProgress(p: number): void {
    const [a, b, t] = this.findSegment(p);

    const pos = a.characterPos.clone().lerp(b.characterPos, t);
    const rotY = THREE.MathUtils.lerp(a.characterRotY, b.characterRotY, t);
    const camPos = a.cameraPos.clone().lerp(b.cameraPos, t);
    const lookAt = a.lookAt.clone().lerp(b.lookAt, t);

    if (this.character) {
      this.character.root.position.copy(pos);
      this.character.root.rotation.y = rotY;
    }
    this.cameraSvc.camera.position.copy(camPos);
    this.cameraSvc.lookTarget.copy(lookAt);

    const nextState = t < 0.5 ? a.state : b.state;
    if (nextState !== this.currentState) {
      this.character?.play(nextState, { crossfade: 0.5 });
      this.currentState = nextState;
    }

    this.stageProps(p);
  }

  /** Scale set-pieces in/out with a smoothstep so they feel staged, not toggled. */
  private stageProps(p: number): void {
    const smooth = (edge0: number, edge1: number, x: number) => {
      const v = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
      return v * v * (3 - 2 * v);
    };
    if (this.desk) {
      const deskIn = smooth(0.34, 0.42, p) * (1 - smooth(0.63, 0.7, p));
      this.desk.scale.setScalar(0.001 + deskIn * 0.999);
    }
    if (this.motorcycle) {
      const bikeIn = smooth(0.63, 0.71, p) * (1 - smooth(0.82, 0.88, p));
      this.motorcycle.scale.setScalar(0.001 + bikeIn * 0.999);
    }
  }

  private findSegment(p: number): [Keyframe, Keyframe, number] {
    for (let i = 0; i < KEYFRAMES.length - 1; i++) {
      const a = KEYFRAMES[i];
      const b = KEYFRAMES[i + 1];
      if (p >= a.progress && p <= b.progress) {
        const t = (p - a.progress) / (b.progress - a.progress || 1);
        return [a, b, t];
      }
    }
    const last = KEYFRAMES[KEYFRAMES.length - 1];
    return [last, last, 0];
  }

  dispose(): void {
    this.st?.kill();
  }
}
