import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-loading-screen',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './loading-screen.component.html',
  styleUrl: './loading-screen.component.scss',
})
export class LoadingScreenComponent {}
