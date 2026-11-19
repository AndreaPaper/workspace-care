import { Component, inject, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Area } from '../../models/models';
import { AreaOverviewService, AreaStats } from '../../services/area-overview.service';
import { AreasService } from '../../services/areas.service';

const EMPTY: AreaStats = { items: 0, containers: 0, units: 0, checks: 0, checksLate: 0, ideasOpen: 0, requestsOpen: 0, rules: 0, links: 0 };

/** One card per area with its numbers; a click opens the area page. */
@Component({
  selector: 'app-areas',
  imports: [FormsModule, RouterLink],
  template: `
    <p class="intro">Le zone dell'ufficio. Apri un'area per vedere tutto quello che la riguarda: cassetti, regole, idee e richieste.</p>
    @if (error()) { <p class="error" role="alert">{{ error() }}</p> }

    <div class="grid">
      @for (a of areas(); track a.id) {
        <article class="card" (click)="open(a)">
          <header>
            @if (editingId() === a.id) {
              <form class="rename" (click)="$event.stopPropagation()" (ngSubmit)="saveEdit(a)">
                <input name="rename" class="edit" [(ngModel)]="editName" aria-label="Nuovo nome" (keyup.escape)="editingId.set('')" />
                <button type="submit" class="small ok">Salva</button>
                <button type="button" class="small" (click)="editingId.set('')">Annulla</button>
              </form>
            } @else {
              <a class="title" [routerLink]="['/ufficio/aree', a.id]" (click)="$event.stopPropagation()">{{ a.nome }}</a>
              <button type="button" class="pencil" (click)="startEdit(a); $event.stopPropagation()" [attr.aria-label]="'Rinomina ' + a.nome" title="Rinomina">✎</button>
            }
          </header>

          <div class="tiles">
            <a class="tile" routerLink="/ufficio" [queryParams]="{ tab: 'inventario' }" (click)="$event.stopPropagation()"><b>{{ st(a).items }}</b><span>oggetti</span></a>
            @if (st(a).units || !st(a).containers) {
              <a class="tile" routerLink="/ufficio" [queryParams]="{ tab: 'cassettiere' }" (click)="$event.stopPropagation()"><b>{{ st(a).units }}</b><span>{{ st(a).units === 1 ? 'cassettiera' : 'cassettiere' }}</span></a>
            } @else {
              <a class="tile" routerLink="/ufficio" [queryParams]="{ tab: 'inventario' }" (click)="$event.stopPropagation()"><b>{{ st(a).containers }}</b><span>{{ st(a).containers === 1 ? 'contenitore' : 'contenitori' }}</span></a>
            }
            <a class="tile" [class.late]="st(a).checksLate > 0" routerLink="/controlli" (click)="$event.stopPropagation()">
              <b>{{ st(a).checks }}</b><span>{{ st(a).checksLate ? st(a).checksLate + ' in ritardo' : (st(a).checks === 1 ? 'controllo' : 'controlli') }}</span>
            </a>
          </div>

          <p class="sum">{{ summary(a) }}</p>

          @if (!st(a).links) {
            <div class="empty-row">
              <span>Ancora vuota</span>
              <button type="button" class="danger" (click)="remove(a); $event.stopPropagation()">Elimina area</button>
            </div>
          }
        </article>
      }

      <form class="card add" (ngSubmit)="add()">
        <label for="newarea">Nuova area</label>
        <input id="newarea" name="new" [(ngModel)]="newName" placeholder="Es. Sala riunioni" />
        <button type="submit" class="primary" [disabled]="!newName.trim()">Aggiungi</button>
      </form>
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 14px; font-family: Inter, system-ui, sans-serif; }
    .intro { margin: 0; color: #5a5c53; font-size: 14px; }
    .error { margin: 0; color: #b42318; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
    .card { background: #fff; border-radius: 20px; padding: 16px; display: flex; flex-direction: column; gap: 12px; cursor: pointer; border: 1px solid #ece7db; }
    .card:hover { border-color: #cfc9bb; }
    header { display: flex; align-items: center; gap: 8px; min-height: 32px; }
    .title { flex: 1; font: 800 18px 'Plus Jakarta Sans', Inter, sans-serif; color: #22241f; text-decoration: none; }
    .title:hover { text-decoration: underline; }
    .pencil { width: 32px; height: 32px; border: 0; border-radius: 999px; background: transparent; cursor: pointer; font-size: 16px; color: #45473f; }
    .pencil:hover { background: #f3f0e9; }
    .rename { display: flex; gap: 6px; flex: 1; align-items: center; flex-wrap: wrap; }
    .edit { flex: 1; min-width: 100px; height: 36px; padding: 0 10px; border: 1px solid #cfc9bb; border-radius: 10px; font: 600 15px Inter, system-ui, sans-serif; }
    .small { height: 36px; padding: 0 12px; border: 1px solid #cfc9bb; border-radius: 999px; background: #fff; font: 600 13px Inter, system-ui, sans-serif; cursor: pointer; }
    .small.ok { background: #2e6a4f; border-color: #2e6a4f; color: #fff; }
    .tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .tile { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 64px; padding: 6px; border-radius: 12px; background: #f4f2ec; color: #22241f; text-decoration: none; text-align: center; }
    .tile b { font-size: 20px; }
    .tile span { font-size: 12px; color: #45473f; }
    .tile:hover { filter: brightness(.97); }
    .tile.late { background: #fdf1ef; }
    .tile.late b, .tile.late span { color: #9b1c12; font-weight: 700; }
    .sum { margin: 0; font-size: 13px; color: #45473f; }
    .empty-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; color: #55584f; }
    .danger { border: 0; background: transparent; color: #b42318; font: 600 13px Inter, system-ui, sans-serif; padding: 8px 4px; cursor: pointer; }
    .add { background: #f3f8f5; border: 1.5px dashed #6fa88a; cursor: default; justify-content: center; }
    .add label { font: 800 16px 'Plus Jakarta Sans', Inter, sans-serif; color: #173d2b; }
    .add input { height: 40px; padding: 0 12px; border: 1px solid #b9cfc3; border-radius: 12px; font: 14px Inter, system-ui, sans-serif; background: #fff; }
    .primary { height: 44px; border: 0; border-radius: 999px; background: #2e6a4f; color: #fff; font: 700 14px Inter, system-ui, sans-serif; cursor: pointer; }
    .primary:disabled { opacity: .5; cursor: default; }
    a:focus-visible, button:focus-visible, input:focus-visible { outline: 3px solid #2f6fb5; outline-offset: 2px; }
  `,
})
export class Areas implements OnInit {
  /** Emitted after any change, so that the tab counters of the Ufficio page can refresh. */
  readonly changed = output<void>();
  private readonly areasService = inject(AreasService);
  private readonly overview = inject(AreaOverviewService);
  private readonly router = inject(Router);

  readonly areas = signal<Area[]>([]);
  readonly stats = signal<Record<string, AreaStats>>({});
  readonly editingId = signal('');
  readonly error = signal('');
  newName = '';
  editName = '';

  ngOnInit(): Promise<void> {
    return this.reload();
  }

  private async reload(): Promise<void> {
    try {
      const [areas, stats] = await Promise.all([this.areasService.list(), this.overview.load()]);
      this.areas.set(areas);
      this.stats.set(stats);
      this.changed.emit();
    } catch {
      this.error.set('Impossibile caricare le aree.');
    }
  }

  st(a: Area): AreaStats {
    return this.stats()[a.id] ?? EMPTY;
  }

  summary(a: Area): string {
    const s = this.st(a);
    const parts: string[] = [];
    if (s.ideasOpen) parts.push(`${s.ideasOpen} ${s.ideasOpen === 1 ? 'idea aperta' : 'idee aperte'}`);
    if (s.requestsOpen) parts.push(`${s.requestsOpen} ${s.requestsOpen === 1 ? 'richiesta in corso' : 'richieste in corso'}`);
    if (s.rules) parts.push(`${s.rules} ${s.rules === 1 ? 'regola' : 'regole'}`);
    return parts.length ? parts.join(' · ') : 'Niente di aperto';
  }

  open(a: Area): void {
    if (this.editingId() === a.id) return;
    void this.router.navigate(['/ufficio/aree', a.id]);
  }

  async add(): Promise<void> {
    this.error.set('');
    const name = this.newName.trim();
    if (!name) return;
    try {
      await this.areasService.create(name);
      this.newName = '';
    } catch {
      this.error.set(`Impossibile aggiungere "${name}": esiste già un'area con questo nome.`);
    }
    await this.reload();
  }

  startEdit(a: Area): void {
    this.error.set('');
    this.editName = a.nome;
    this.editingId.set(a.id);
    setTimeout(() => document.querySelector<HTMLInputElement>('input.edit')?.select());
  }

  async saveEdit(a: Area): Promise<void> {
    this.error.set('');
    const name = this.editName.trim();
    if (name && name !== a.nome) {
      try {
        await this.areasService.rename(a.id, name);
      } catch {
        // Keep the field open so the name can be corrected.
        this.error.set(`Impossibile rinominare in "${name}": esiste già un'area con questo nome.`);
        return;
      }
    }
    this.editingId.set('');
    await this.reload();
  }

  async remove(a: Area): Promise<void> {
    this.error.set('');
    if (this.st(a).links) return;
    if (!confirm(`Eliminare l'area "${a.nome}"?`)) return;
    try {
      await this.areasService.remove(a.id);
    } catch {
      this.error.set(`Impossibile eliminare "${a.nome}": è usata da altri elementi.`);
    }
    await this.reload();
  }
}
