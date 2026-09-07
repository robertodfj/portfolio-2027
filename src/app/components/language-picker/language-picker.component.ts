import { Component, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '../../shared/language.service';

/**
 * Los dos círculos de idioma del hero. Las banderas van en SVG y NO en emoji
 * (🇪🇸 / 🇬🇧) por un motivo práctico: Windows no incluye glifos de bandera, así
 * que ahí los emoji se ven como las letras "ES" y "GB" — justo lo contrario
 * de lo que se pedía.
 */
@Component({
  selector: 'app-language-picker',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './language-picker.component.html',
  styleUrl: './language-picker.component.scss',
})
export class LanguagePickerComponent {
  readonly lang = inject(LanguageService);
}
