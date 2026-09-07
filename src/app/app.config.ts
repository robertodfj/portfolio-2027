import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

/**
 * Los textos viven en src/assets/i18n/{es,en}.json y se cargan en caliente,
 * NO se compilan dentro del bundle. Es lo que permite cambiar de idioma sin
 * recargar y, sobre todo, que añadir o corregir una frase sea editar un JSON
 * — que es justo lo que se pidió.
 *
 * (Por eso ngx-translate y no @angular/localize, el i18n nativo de Angular:
 * ese resuelve en tiempo de compilación y obliga a un build y una URL por
 * idioma, así que no hay forma de ponerle un selector en caliente.)
 */
export function translateLoaderFactory(http: HttpClient): TranslateLoader {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    provideHttpClient(),
    importProvidersFrom(
      TranslateModule.forRoot({
        loader: {
          provide: TranslateLoader,
          useFactory: translateLoaderFactory,
          deps: [HttpClient],
        },
      }),
    ),
  ],
};
