import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from './shared/language.service';
import { ThemeService } from './shared/theme.service';
import { ThreeSceneService } from './three/three-scene.service';
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
  standalone: true,
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

  readonly loading = signal(true);
  readonly usingPlaceholder = signal(false);
  readonly showScrollTop = signal(false);

  constructor(
    private sceneSvc: ThreeSceneService,
    private cameraSvc: CameraService,
    private modelLoader: ModelLoaderService,
    private animationSvc: AnimationService,
    private language: LanguageService,
    private theme: ThemeService,
  ) {
    // Antes del primer render: así no se ve un parpadeo de idioma o de tema.
    this.language.init();
    this.theme.init();

    // La escena 3D no ve el CSS — hay que pasarle el tema a mano. El effect
    // se dispara también en el arranque, así que cubre el estado inicial.
    effect(() => {
      const theme = this.theme.current();
      this.sceneSvc.applyTheme(theme); // niebla y suelo
      this.animationSvc.applyTheme(theme); // partículas
    });
  }

  async ngAfterViewInit(): Promise<void> {
    this.sceneSvc.mount(this.canvasRef.nativeElement);

    const character = await this.modelLoader.loadCharacter();
    this.usingPlaceholder.set(character.usingPlaceholder);

    // Un único tick por frame: AnimationService lo registra y desde ahí
    // orquesta scroll -> timeline -> personaje -> cámara, en ese orden.
    this.animationSvc.init(character, document.body);
    this.sceneSvc.startLoop(this.cameraSvc.camera);

    // Small delay so the "LOADING EXPERIENCE" moment reads intentionally
    // rather than flashing away instantly on fast connections.
    window.setTimeout(() => this.loading.set(false), 600);

    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('load', () => this.animationSvc.refresh());
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private onScroll = (): void => {
    this.showScrollTop.set(window.scrollY > window.innerHeight * 0.6);
  };

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll);
    this.animationSvc.dispose();
  }
}
