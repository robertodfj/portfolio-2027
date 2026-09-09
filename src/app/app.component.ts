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
import { LOADING } from './three/narrative.config';
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
  /** Dispara el fundido del velo; al terminar se desmonta. */
  readonly loaderLeaving = signal(false);
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

    // La anisotropía depende de la GPU, así que se consulta al renderer ya
    // montado y se pasa antes de cargar ningún modelo.
    this.modelLoader.setMaxAnisotropy(this.sceneSvc.renderer.capabilities.getMaxAnisotropy());

    // Presupuesto único para toda la carga. Cada espera se queda con lo que
    // quede, de modo que el velo no puede durar más de LOADING.MAX_MS por muy
    // mal que vaya la red.
    const t0 = performance.now();
    const restante = () => Math.max(0, LOADING.MAX_MS - (performance.now() - t0));

    const character = await this.modelLoader.loadCharacter(undefined, restante());
    this.usingPlaceholder.set(character.usingPlaceholder);

    // Un único tick por frame: AnimationService orquesta desde ahí
    // scroll -> timeline -> personaje -> cámara, en ese orden.
    this.animationSvc.init(character, document.body);
    this.sceneSvc.startLoop(this.cameraSvc.camera);

    // Se descubre con la escena completa —moto montada y shaders compilados—,
    // no en cuanto llega el personaje. Si el presupuesto se agota antes, se
    // descubre igual y lo que falte entra después.
    await Promise.race([this.animationSvc.whenReady(), espera(restante())]);

    // Y nunca menos de MIN_MS, para que no sea un parpadeo en conexiones
    // rápidas ni ahora que suele terminar antes.
    await espera(LOADING.MIN_MS - (performance.now() - t0));

    this.loaderLeaving.set(true);
    window.setTimeout(() => this.loading.set(false), LOADING.FADE_MS);

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

/** Espera pasiva; con ms <= 0 cede solo un tick. */
function espera(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, Math.max(0, ms)));
}
