import { Component, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { SearchHit, SearchService } from '../../services/search.service';

@Component({
  selector: 'app-global-search',
  imports: [FormsModule, RouterLink, MatIconModule],
  template: `
    <div class="wrap">
      <label class="bar">
        <mat-icon aria-hidden="true">search</mat-icon>
        <span class="sr">Cerca in tutta l'app</span>
        <input
          #input
          type="search"
          autocomplete="off"
          placeholder="Cerca idee, richieste, acquisti, inventario, regole…"
          [ngModel]="query()"
          (ngModelChange)="onQuery($event)"
          (keydown.escape)="clear()"
          (keydown.enter)="openFirst()"
        />
        <kbd>Ctrl K</kbd>
      </label>
      @if (query().trim().length >= 2) {
        <div class="panel" aria-live="polite">
          @if (searching()) {
            <p class="muted">Ricerca in corso…</p>
          } @else {
            @for (g of groups(); track g.type) {
              <span class="group">{{ g.type }}</span>
              @for (h of g.hits; track h.title + h.detail) {
                <a class="hit" [routerLink]="h.link" [queryParams]="h.withQuery ? { q: query().trim() } : null" (click)="clear()">
                  <mat-icon aria-hidden="true">{{ h.icon }}</mat-icon>
                  <span class="txt"><strong>{{ h.title }}</strong><small>{{ h.detail }}</small></span>
                </a>
              }
            } @empty {
              <p class="muted">Nessun risultato per «{{ query().trim() }}».</p>
            }
          }
        </div>
      }
    </div>
  `,
  styles: `
    .wrap { position: relative; }
    .bar { display: flex; align-items: center; gap: 10px; height: 48px; padding: 0 16px; border-radius: 999px; background: #fff; border: 1px solid #ddd7cb; color: #55584f; }
    .bar:focus-within { border-color: #2f6fb5; box-shadow: 0 0 0 3px #d8e7f7; }
    input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; font: 14px Inter, system-ui, sans-serif; color: #22241f; }
    kbd { font: inherit; font-size: 11px; padding: 3px 8px; border-radius: 6px; background: #efebe3; color: #55584f; }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .panel { position: absolute; z-index: 20; left: 0; right: 0; top: 54px; max-height: 60vh; overflow: auto; padding: 8px; border-radius: 20px; background: #fff; border: 1px solid #ddd7cb; box-shadow: 0 12px 32px rgb(34 36 31 / .14); }
    .group { display: block; padding: 10px 10px 4px; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #45473f; }
    .hit { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 12px; color: #22241f; text-decoration: none; }
    .hit:hover, .hit:focus-visible { background: #f6f2ea; outline: none; }
    .txt { display: flex; flex-direction: column; min-width: 0; }
    .txt strong { font-weight: 600; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .txt small { font-size: 12px; color: #55584f; }
    .muted { margin: 0; padding: 10px; color: #55584f; font-size: 13px; }
    @media (max-width: 800px) { kbd { display: none; } }
  `,
})
export class GlobalSearch {
  private readonly search = inject(SearchService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');

  readonly query = signal('');
  readonly hits = signal<SearchHit[]>([]);
  readonly searching = signal(false);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private ticket = 0;

  readonly groups = () => {
    const by = new Map<string, SearchHit[]>();
    for (const h of this.hits()) by.set(h.type, [...(by.get(h.type) ?? []), h]);
    return [...by.entries()].map(([type, hits]) => ({ type, hits }));
  };

  onQuery(value: string): void {
    this.query.set(value);
    clearTimeout(this.timer);
    const q = value.trim();
    if (q.length < 2) {
      this.hits.set([]);
      this.searching.set(false);
      return;
    }
    this.searching.set(true);
    const ticket = ++this.ticket;
    this.timer = setTimeout(async () => {
      try {
        const hits = await this.search.search(q);
        if (ticket === this.ticket) this.hits.set(hits);
      } catch {
        if (ticket === this.ticket) this.hits.set([]);
      } finally {
        if (ticket === this.ticket) this.searching.set(false);
      }
    }, 250);
  }

  clear(): void {
    this.ticket++;
    clearTimeout(this.timer);
    this.query.set('');
    this.hits.set([]);
    this.searching.set(false);
  }

  openFirst(): void {
    const first = this.hits()[0];
    if (!first) return;
    const q = this.query().trim();
    void this.router.navigate(first.link, first.withQuery ? { queryParams: { q } } : {});
    this.clear();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.input().nativeElement.focus();
      this.input().nativeElement.select();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (!this.host.nativeElement.contains(e.target as Node)) this.clear();
  }
}
