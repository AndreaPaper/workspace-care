import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PocketBaseService } from '../pocketbase.service';

interface NavItem {
  label: string;
  icon: string;
  path: string;
  enabled: boolean;
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatButtonModule, MatIconModule],
  template: `
    <header class="topbar">
      <button mat-icon-button (click)="menuOpen.set(!menuOpen())" aria-label="Menu"><mat-icon>menu</mat-icon></button>
      <strong>Workspace Care</strong>
    </header>
    <div class="layout">
      <nav class="sidebar" [class.open]="menuOpen()">
        @for (item of nav; track item.path) {
          @if (item.enabled) {
            <a [routerLink]="item.path" routerLinkActive="active" (click)="menuOpen.set(false)">
              <mat-icon>{{ item.icon }}</mat-icon> {{ item.label }}
            </a>
          } @else {
            <span class="disabled" title="Disponibile nelle prossime fasi">
              <mat-icon>{{ item.icon }}</mat-icon> {{ item.label }}
            </span>
          }
        }
        <a class="logout" (click)="logout()"><mat-icon>logout</mat-icon> Esci</a>
      </nav>
      <main><router-outlet /></main>
    </div>
  `,
  styles: `
    :host { display: block; min-height: 100vh; }
    .topbar { display: none; align-items: center; gap: .5rem; padding: .25rem 1rem; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .layout { display: flex; min-height: 100vh; }
    .sidebar { width: 220px; padding: 1rem .5rem; border-right: 1px solid var(--mat-sys-outline-variant); display: flex; flex-direction: column; gap: .25rem; background: var(--mat-sys-surface-container-low); }
    .sidebar a, .sidebar .disabled { padding: .5rem .8rem; border-radius: 999px; color: inherit; text-decoration: none; cursor: pointer; display: flex; gap: .6rem; align-items: center; }
    .sidebar a:hover { background: var(--mat-sys-surface-container-high); }
    .sidebar a.active { background: var(--mat-sys-secondary-container); font-weight: 600; }
    .sidebar .disabled { opacity: .4; cursor: default; }
    .logout { margin-top: auto; }
    main { flex: 1; padding: 1.5rem; min-width: 0; }
    @media (max-width: 800px) {
      .topbar { display: flex; }
      .layout { min-height: auto; flex-direction: column; }
      .sidebar { display: none; width: auto; border-right: 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
      .sidebar.open { display: flex; }
      main { padding: 1rem; }
    }
  `,
})
export class Shell {
  private readonly pb = inject(PocketBaseService);
  private readonly router = inject(Router);
  readonly menuOpen = signal(false);

  readonly nav: NavItem[] = [
    { label: 'Dashboard', icon: 'home', path: '/dashboard', enabled: true },
    { label: 'Idee', icon: 'lightbulb', path: '/idee', enabled: true },
    { label: 'Richieste', icon: 'inbox', path: '/richieste', enabled: false },
    { label: 'Acquisti', icon: 'shopping_cart', path: '/acquisti', enabled: false },
    { label: 'Controlli', icon: 'checklist', path: '/controlli', enabled: false },
    { label: 'Inventario', icon: 'inventory_2', path: '/inventario', enabled: false },
    { label: 'Cassettiere', icon: 'table_rows', path: '/cassettiere', enabled: false },
    { label: 'Regole', icon: 'menu_book', path: '/regole', enabled: false },
    { label: 'Aree', icon: 'map', path: '/aree', enabled: true },
  ];

  logout(): void {
    this.pb.logout();
    this.router.navigateByUrl('/login');
  }
}
