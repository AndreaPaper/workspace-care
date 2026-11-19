import { Component, inject, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { BadgesService } from '../../services/badges.service';
import { GlobalSearch } from '../search/global-search';

interface NavItem {
  label: string;
  icon: string;
  path: string;
  badge?: 'requests' | 'checks';
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, MatMenuModule, GlobalSearch],
  template: `
    <nav class="rail" aria-label="Navigazione principale">
      <a class="logo" routerLink="/dashboard" aria-label="Workspace Care, vai a Oggi">WC</a>

      <button type="button" class="item new" [matMenuTriggerFor]="newMenu" aria-label="Nuovo elemento">
        <span class="plus"><mat-icon aria-hidden="true">add</mat-icon></span>
        Nuovo
      </button>
      <mat-menu #newMenu="matMenu" xPosition="after">
        <a mat-menu-item routerLink="/idee" [queryParams]="{ nuova: 1 }"><mat-icon>lightbulb</mat-icon> Idea</a>
        <a mat-menu-item routerLink="/richieste" [queryParams]="{ nuova: 1 }"><mat-icon>inbox</mat-icon> Richiesta</a>
        <a mat-menu-item routerLink="/acquisti" [queryParams]="{ nuova: 1 }"><mat-icon>shopping_cart</mat-icon> Acquisto</a>
        <a mat-menu-item routerLink="/controlli" [queryParams]="{ nuova: 1 }"><mat-icon>checklist</mat-icon> Controllo</a>
      </mat-menu>

      @for (item of main; track item.path) {
        <a class="item" [routerLink]="item.path" routerLinkActive="active" [attr.aria-label]="ariaLabel(item)">
          <span class="ico">
            <mat-icon aria-hidden="true">{{ item.icon }}</mat-icon>
            @if (count(item); as n) {
              <span class="badge" [class.late]="item.badge === 'checks' && badges.checksLate() > 0" [class.ok]="item.badge === 'requests'" aria-hidden="true">{{ n }}</span>
            }
          </span>
          {{ item.label }}
        </a>
      }

      <span class="divider" aria-hidden="true"></span>

      @for (item of office; track item.path) {
        <a class="item" [routerLink]="item.path" routerLinkActive="active">
          <span class="ico"><mat-icon aria-hidden="true">{{ item.icon }}</mat-icon></span>
          {{ item.label }}
        </a>
      }
    </nav>

    <div class="content">
      <app-global-search />
      <main><router-outlet /></main>
    </div>
  `,
  styles: `
    :host { display: flex; min-height: 100vh; font-family: Inter, system-ui, sans-serif; color: #22241f; }
    .rail { flex: none; width: 92px; box-sizing: border-box; padding: 16px 10px; background: #fff; border-right: 1px solid #e6e2d9; display: flex; flex-direction: column; align-items: center; gap: 4px; position: sticky; top: 0; height: 100vh; overflow-x: hidden; overflow-y: auto; scrollbar-width: thin; }
    .logo { width: 44px; height: 44px; flex: none; margin-bottom: 10px; border-radius: 14px; background: #2f6fb5; color: #fff; display: flex; align-items: center; justify-content: center; font: 800 16px 'Plus Jakarta Sans', Inter, sans-serif; text-decoration: none; }
    .item { width: 72px; box-sizing: border-box; padding: 6px 0 8px; border: 0; background: transparent; display: flex; flex-direction: column; align-items: center; gap: 4px; border-radius: 8px; color: #3b4a5c; text-decoration: none; font: 500 11px Inter, system-ui, sans-serif; cursor: pointer; flex: none; }
    .item:hover { background: #f3f0e9; }
    .item:focus-visible { outline: 3px solid #2f6fb5; outline-offset: 1px; }
    .ico { position: relative; width: 56px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 16px; }
    mat-icon { width: 22px; height: 22px; font-size: 22px; }
    /* The whole active entry is highlighted, with a blue edge on the content side. */
    .item.active { background: #e6f1fc; border-right: 3px solid #2f6fb5; color: #0f3b6e; font-weight: 700; }
    .new { margin-bottom: 6px; color: #0f2e52; font-weight: 600; padding-bottom: 10px; }
    .plus { width: 56px; height: 56px; border-radius: 18px; background: #2f6fb5; color: #fff; display: flex; align-items: center; justify-content: center; }
    .plus mat-icon { width: 26px; height: 26px; font-size: 26px; }
    .badge { position: absolute; top: -2px; right: 6px; min-width: 18px; height: 18px; padding: 0 4px; box-sizing: border-box; border-radius: 999px; background: #8a5a00; color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
    .badge.late { background: #b42318; }
    .badge.ok { background: #2e6a4f; }
    .divider { width: 48px; height: 1px; margin: 8px 12px; background: #e6e2d9; flex: none; }
    .content { flex: 1; min-width: 0; box-sizing: border-box; padding: 20px 40px 40px; display: flex; flex-direction: column; gap: 22px; }
    main { min-width: 0; }
    @media (max-width: 800px) {
      :host { flex-direction: column; }
      .rail { width: auto; height: auto; flex-direction: row; align-items: flex-start; justify-content: flex-start; padding: 8px 10px; border-right: 0; border-bottom: 1px solid #e6e2d9; overflow-x: auto; overflow-y: hidden; z-index: 5; gap: 2px; }
      .logo { margin: 4px 6px 0 0; }
      .new { margin: 0; padding-bottom: 6px; }
      .plus { width: 40px; height: 40px; border-radius: 14px; }
      .divider { width: 1px; height: 40px; margin: 8px 6px; }
      .content { padding: 14px 16px 32px; gap: 16px; }
    }
  `,
})
export class Shell implements OnInit {
  private readonly router = inject(Router);
  readonly badges = inject(BadgesService);

  readonly main: NavItem[] = [
    { label: 'Oggi', icon: 'home', path: '/dashboard' },
    { label: 'Richieste', icon: 'inbox', path: '/richieste', badge: 'requests' },
    { label: 'Controlli', icon: 'checklist', path: '/controlli', badge: 'checks' },
    { label: 'Idee', icon: 'lightbulb', path: '/idee' },
    { label: 'Acquisti', icon: 'shopping_cart', path: '/acquisti' },
  ];

  readonly office: NavItem[] = [
    { label: 'Inventario', icon: 'inventory_2', path: '/inventario' },
    { label: 'Cassettiere', icon: 'table_rows', path: '/cassettiere' },
    { label: 'Regole', icon: 'menu_book', path: '/regole' },
    { label: 'Riepilogo', icon: 'description', path: '/riepilogo' },
    { label: 'Aree', icon: 'map', path: '/aree' },
  ];

  ngOnInit(): void {
    void this.badges.refresh();
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => void this.badges.refresh());
  }

  /** Number shown on the badge: open requests, or checks late or due today. */
  count(item: NavItem): number {
    if (item.badge === 'requests') return this.badges.openRequests();
    if (item.badge === 'checks') return this.badges.checksLate() + this.badges.checksToday();
    return 0;
  }

  ariaLabel(item: NavItem): string | null {
    const n = this.count(item);
    if (!n) return null;
    return item.badge === 'requests' ? `${item.label}, ${n} aperte` : `${item.label}, ${n} da fare`;
  }
}
