import { Component, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface NavLink {
  label: string;
  id: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  readonly links: NavLink[] = [
    { label: 'Sobre mí', id: 'about' },
    { label: 'Experiencia', id: 'experience' },
    { label: 'Tecnologías', id: 'technologies' },
    { label: 'Proyectos', id: 'projects' },
    { label: 'Contacto', id: 'contact' },
  ];

  readonly progress = signal(0);
  readonly menuOpen = signal(false);

  @HostListener('window:scroll')
  onScroll(): void {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    this.progress.set(max > 0 ? (doc.scrollTop / max) * 100 : 0);
  }

  goTo(id: string): void {
    this.menuOpen.set(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }
}
