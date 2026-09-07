import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ThemeService } from '../../shared/theme.service';

/** Interruptor claro/oscuro. Vive en la barra superior para estar siempre a mano. */
@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.scss',
})
export class ThemeToggleComponent {
  readonly theme = inject(ThemeService);
}
