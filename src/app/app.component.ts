import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from './shared/language.service';
import { ThemeService } from './shared/theme.service';
import { AccentService } from './shared/accent.service';
import { ThreeSceneService, WebGLUnavailableError } from './three/three-scene.service';
import { CameraService } from './three/camera.service';
import { ModelLoaderService } from './three/model-loader.service';
import { AnimationService } from './three/animation.service';
import { NavbarComponent } from './components/navbar/navbar.component';
import { LoadingScreenComponent } from './components/loading-screen/loading-screen.component';
import { HeroComponent } from './components/hero/hero.component';
import { AboutComponent } from './components/about/about.component';
import { ExperienceComponent } from './components/experience/experience.component';
import { TechnologiesComponent } from './components/technologies/technologies.component';
import { ProjectsComponent } from './components/projects/projects.component';
import { ContactComponent } from './components/contact/contact.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
      CommonModule,
      TranslateModule,
      NavbarComponent,
      LoadingScreenComponent,
      HeroComponent,
      AboutComponent,
      ExperienceComponent,
      TechnologiesComponent,
      ProjectsComponent,
      ContactComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('sceneCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private readonly zone = inject(NgZone);
  private readonly accent = inject(AccentService);

  readonly loading = signal(true);
  readonly usingPlaceholder = signal(false);
  readonly showScrollTop = signal(false);
  /** El navegador no puede pintar la escena: se avisa en vez de fallar en silencio. */
  readonly sceneUnavailable = signal(false);

  constructor(
    private sceneSvc: ThreeSceneService,
    private cameraSvc: CameraService,
    private modelLoader: ModelLoaderService,
    private animationSvc: AnimationService,
    private language: LanguageService,
    private theme: ThemeService,
  ) {
    // Antes del primer render: así no parpadea ni el idioma ni el tema.
    this.language.init();
    this.theme.init();

    // La escena 3D no ve el CSS, hay que pasarle tema y acento a mano.
    effect(() => {
      const theme = this.theme.current();
      this.sceneSvc.applyTheme(theme);
      this.animationSvc.applyTheme(theme);
    });

    effect(() => this.sceneSvc.setAccent(this.accent.accentHex()));
  }

  async ngAfterViewInit(): Promise<void> {
    try {
      this.sceneSvc.mount(this.canvasRef.nativeElement);
    } catch (err) {
      if (err instanceof WebGLUnavailableError) {
        this.sceneUnavailable.set(true);
        this.loading.set(false);
        return;
      }
      throw err;
    }

    const character = await this.modelLoader.loadCharacter();
    this.usingPlaceholder.set(character.usingPlaceholder);

    // Un único tick por frame: AnimationService orquesta desde ahí
    // scroll -> timeline -> personaje -> cámara, en ese orden.
    this.animationSvc.init(character, document.body);
    this.sceneSvc.startLoop(this.cameraSvc.camera);

    // Pequeño margen para que el "LOADING" se lea a propósito y no como un
    // parpadeo en conexiones rápidas.
    window.setTimeout(() => this.loading.set(false), 600);

    // Fuera de la zona: el scroll dispara cientos de eventos por segundo y no
    // hace falta un ciclo de detección de cambios por cada uno.
    this.zone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
    });

    // Si el documento ya había cargado, el evento no volverá a dispararse.
    if (document.readyState === 'complete') this.animationSvc.refresh();
    else window.addEventListener('load', this.onLoad, { once: true });
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private onLoad = (): void => this.animationSvc.refresh();

  private onScroll = (): void => {
    const visible = window.scrollY > window.innerHeight * 0.6;
    if (visible === this.showScrollTop()) return;
    // El signal se escribe fuera de la zona, así que hay que volver a entrar
    // para que la vista se entere.
    this.zone.run(() => this.showScrollTop.set(visible));
  };

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('load', this.onLoad);
    this.animationSvc.dispose();
  }
}
