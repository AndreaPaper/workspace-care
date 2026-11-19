import { Component, computed, inject, DestroyRef, OnInit, signal } from '@angular/core';
import { watchPageParams } from '../../core/page-params';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Area, IDEA_CATEGORIES, IDEA_PRIORITIES, IDEA_STATUSES, Idea, IdeaStatus, labelOf } from '../../models/models';
import { AreasService } from '../../services/areas.service';
import { IdeaLinksService } from '../../services/idea-links.service';
import { IdeasService } from '../../services/ideas.service';
import { NewIdeaDialog } from './new-idea-dialog';

@Component({
  selector: 'app-ideas',
  imports: [FormsModule, RouterLink, MatButtonModule, MatButtonToggleModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  template: `
    <div class="head">
      <h1>Idee</h1>
      <mat-button-toggle-group [(ngModel)]="view" aria-label="Vista">
        <mat-button-toggle value="grid">Griglia</mat-button-toggle>
        <mat-button-toggle value="kanban">Kanban</mat-button-toggle>
      </mat-button-toggle-group>
      <button mat-flat-button (click)="openDialog()"><mat-icon>add</mat-icon> Nuova idea</button>
    </div>

    <div class="filters">
      <mat-form-field>
        <mat-label>Cerca per titolo</mat-label>
        <input matInput [ngModel]="search()" (ngModelChange)="search.set($event)" />
      </mat-form-field>
      <mat-form-field>
        <mat-label>Area</mat-label>
        <mat-select [value]="areaFilter()" (selectionChange)="areaFilter.set($event.value)">
          <mat-option value="">Tutte</mat-option>
          @for (a of areas(); track a.id) { <mat-option [value]="a.id">{{ a.nome }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field>
        <mat-label>Categoria</mat-label>
        <mat-select [value]="categoryFilter()" (selectionChange)="categoryFilter.set($event.value)">
          <mat-option value="">Tutte</mat-option>
          @for (c of categories; track c.value) { <mat-option [value]="c.value">{{ c.label }}</mat-option> }
        </mat-select>
      </mat-form-field>
      @if (view === 'grid') {
        <mat-form-field>
          <mat-label>Stato</mat-label>
          <mat-select [value]="statusFilter()" (selectionChange)="statusFilter.set($event.value)">
            <mat-option value="">Tutti</mat-option>
            @for (s of statuses; track s.value) { <mat-option [value]="s.value">{{ s.label }}</mat-option> }
          </mat-select>
        </mat-form-field>
      }
    </div>

    @if (view === 'grid') {
      <div class="cards">
        @for (idea of filtered(); track idea.id) {
          <a class="card" [routerLink]="['/idee', idea.id]">
            <div class="cover" [style.background-image]="cover(idea)"></div>
            <div class="body">
              <strong>{{ idea.titolo }}</strong>
              <span class="meta">{{ idea.expand?.area?.nome }} {{ idea.categoria ? '· ' + label(categories, idea.categoria) : '' }}</span>
              <div class="tags">
                <span class="chip">{{ label(statuses, idea.stato) }}</span>
                @if (idea.priorita) { <span class="chip">{{ label(priorities, idea.priorita) }}</span> }
              </div>
              @if (idea.costo_min || idea.costo_max) {
                <span class="meta">€ {{ idea.costo_min || 0 }} – {{ idea.costo_max || idea.costo_min }}</span>
              }
            </div>
          </a>
        } @empty {
          <p class="muted">Nessuna idea trovata.</p>
        }
      </div>
    } @else {
      <div class="kanban">
        @for (col of statuses; track col.value) {
          <section class="column" (dragover)="$event.preventDefault()" (drop)="drop(col.value)">
            <h3>{{ col.label }} <small>{{ byStatus(col.value).length }}</small></h3>
            @for (idea of byStatus(col.value); track idea.id) {
              <div class="kcard" draggable="true" (dragstart)="dragged = idea">
                <a [routerLink]="['/idee', idea.id]">{{ idea.titolo }}</a>
                <small class="muted">{{ idea.expand?.area?.nome }}</small>
                <select class="mobile-move" [ngModel]="idea.stato" (ngModelChange)="move(idea, $event)" aria-label="Sposta in">
                  @for (s of statuses; track s.value) { <option [value]="s.value">{{ s.label }}</option> }
                </select>
              </div>
            }
          </section>
        }
      </div>
    }
  `,
  styles: `
    .head { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .head h1 { margin: 0 auto 0 0; }
    .filters { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }
    .card { border: 1px solid var(--mat-sys-outline-variant); border-radius: 12px; overflow: hidden; color: inherit; text-decoration: none; background: var(--mat-sys-surface-container-lowest); display: flex; flex-direction: column; }
    .card:hover { box-shadow: 0 2px 8px rgb(0 0 0 / .12); }
    .cover { height: 150px; background: var(--mat-sys-surface-container) center/cover no-repeat; }
    .body { padding: .75rem; display: flex; flex-direction: column; gap: .4rem; }
    .tags { display: flex; gap: .4rem; flex-wrap: wrap; }
    .meta { color: var(--mat-sys-on-surface-variant); font-size: .9rem; }
    .kanban { display: flex; gap: .75rem; overflow-x: auto; padding-bottom: .5rem; }
    .column { flex: 0 0 240px; background: var(--mat-sys-surface-container-low); border-radius: 12px; padding: .5rem; min-height: 200px; }
    .column h3 { margin: .25rem .25rem .5rem; font-size: 1rem; }
    .kcard { background: var(--mat-sys-surface-container-lowest); border: 1px solid var(--mat-sys-outline-variant); border-radius: 8px; padding: .5rem; margin-bottom: .5rem; display: flex; flex-direction: column; gap: .25rem; cursor: grab; }
    .kcard a { color: inherit; text-decoration: none; font-weight: 600; }
    .mobile-move { display: none; }
    @media (hover: none) { .mobile-move { display: block; } }
  `,
})
export class Ideas implements OnInit {
  private readonly ideasService = inject(IdeasService);
  private readonly areasService = inject(AreasService);
  private readonly linksService = inject(IdeaLinksService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly matDialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly categories = IDEA_CATEGORIES;
  readonly statuses = IDEA_STATUSES;
  readonly priorities = IDEA_PRIORITIES;
  view: 'grid' | 'kanban' = 'grid';

  readonly ideas = signal<Idea[]>([]);
  readonly areas = signal<Area[]>([]);
  private readonly linkCovers = signal<Record<string, string>>({});
  readonly search = signal('');
  readonly areaFilter = signal('');
  readonly categoryFilter = signal('');
  readonly statusFilter = signal('');
  dragged: Idea | null = null;

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.ideas().filter(
      (i) =>
        (!q || i.titolo.toLowerCase().includes(q)) &&
        (!this.areaFilter() || i.area === this.areaFilter()) &&
        (!this.categoryFilter() || i.categoria === this.categoryFilter()) &&
        (!this.statusFilter() || i.stato === this.statusFilter()),
    );
  });

  async ngOnInit(): Promise<void> {
    const [ideas, areas, links] = await Promise.all([
      this.ideasService.list(),
      this.areasService.list(),
      this.linksService.listAll(),
    ]);
    const covers: Record<string, string> = {};
    for (const l of links) if (l.immagine && !covers[l.idea]) covers[l.idea] = this.linksService.imageUrl(l);
    this.linkCovers.set(covers);
    this.areas.set(areas);
    this.ideas.set(ideas);
    watchPageParams(this.route, this.router, this.destroyRef, { onNew: () => this.openDialog(), onSearch: (q) => this.search.set(q) });
  }

  openDialog(): void {
    this.matDialog
      .open(NewIdeaDialog, { data: { areas: this.areas() }, width: '32rem', maxWidth: '95vw' })
      .afterClosed()
      .subscribe((idea?: Idea) => {
        if (idea) this.router.navigate(['/idee', idea.id]);
      });
  }

  label(list: readonly { value: string; label: string }[], value: string): string {
    return labelOf(list, value);
  }

  cover(idea: Idea): string {
    const url = this.ideasService.coverUrl(idea, this.linkCovers()[idea.id]);
    return url ? `url("${url}")` : 'none';
  }

  byStatus(status: IdeaStatus): Idea[] {
    return this.filtered().filter((i) => i.stato === status);
  }

  drop(status: IdeaStatus): void {
    if (this.dragged && this.dragged.stato !== status) void this.move(this.dragged, status);
    this.dragged = null;
  }

  async move(idea: Idea, status: IdeaStatus): Promise<void> {
    if (idea.stato === status) return;
    const updated = await this.ideasService.update(idea.id, { stato: status });
    this.ideas.update((list) => list.map((i) => (i.id === updated.id ? updated : i)));
  }
}
