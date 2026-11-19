import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Area, Drawer, DrawerUnit, IDEA_PRIORITIES, IDEA_STATUSES, Idea, REQUEST_STATUSES, Rule, WorkRequest, labelOf,
} from '../../models/models';
import { AreasService } from '../../services/areas.service';
import { DrawersService, DrawerUnitsService } from '../../services/drawers.service';
import { IdeasService } from '../../services/ideas.service';
import { RequestsService } from '../../services/requests.service';
import { RulesService } from '../../services/rules.service';
import { Drawers } from '../drawers/drawers';

const CLOSED_IDEAS = ['fatta', 'scartata'];
const OPEN_REQUESTS = ['ricevuta', 'in_valutazione', 'in_corso'];

/** Everything about one area on one page: drawers, rules, open ideas and requests. Route `#/ufficio/aree/:id`. */
@Component({
  selector: 'app-area-detail',
  imports: [Drawers, FormsModule, RouterLink],
  template: `
    @if (missing()) {
      <p class="muted">Quest'area non esiste (più). <a routerLink="/ufficio" [queryParams]="{ tab: 'aree' }">‹ Aree</a></p>
    } @else if (area(); as a) {
      <nav class="crumbs" aria-label="Percorso">
        <a class="back" routerLink="/ufficio" [queryParams]="{ tab: 'aree' }">‹ Aree</a>
        <span>Ufficio › Aree › {{ a.nome }}</span>
      </nav>

      <header class="head">
        @if (editing()) {
          <form class="rename" (ngSubmit)="saveName()">
            <input name="nome" class="edit" [(ngModel)]="editName" aria-label="Nome dell'area" />
            <button type="submit" class="btn small ok">Salva</button>
            <button type="button" class="btn small" (click)="editing.set(false)">Annulla</button>
          </form>
        } @else {
          <h1>{{ a.nome }}</h1>
        }
        <div class="buttons">
          <button type="button" class="btn" (click)="startRename()">Rinomina</button>
          <div class="addwrap">
            <button type="button" class="btn primary" (click)="addOpen.set(!addOpen())" [attr.aria-expanded]="addOpen()">+ Aggiungi qui</button>
            @if (addOpen()) {
              <div class="menu" role="menu">
                <a role="menuitem" routerLink="/idee" [queryParams]="{ nuova: 1, area: a.id }">Idea</a>
                <a role="menuitem" routerLink="/richieste" [queryParams]="{ nuova: 1, area: a.id }">Richiesta</a>
                <a role="menuitem" routerLink="/ufficio" [queryParams]="{ tab: 'inventario', nuova: 1, area: a.id }">Oggetto</a>
                <a role="menuitem" routerLink="/ufficio" [queryParams]="{ tab: 'cassettiere', nuova: 1, area: a.id }">Cassettiera</a>
              </div>
            }
          </div>
        </div>
      </header>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }

      <div class="chips">
        <button type="button" class="chip" (click)="go('sec-cassetti')">{{ occupied() }} {{ occupied() === 1 ? 'cassetto occupato' : 'cassetti occupati' }}</button>
        <button type="button" class="chip dashed" (click)="go('sec-cassetti')">{{ free() }} {{ free() === 1 ? 'libero' : 'liberi' }}</button>
        <button type="button" class="chip" (click)="go('sec-regole')">{{ rules().length }} {{ rules().length === 1 ? 'regola' : 'regole' }}</button>
        <button type="button" class="chip" (click)="go('sec-idee')">{{ openIdeas().length }} {{ openIdeas().length === 1 ? 'idea aperta' : 'idee aperte' }}</button>
        <button type="button" class="chip" (click)="go('sec-richieste')">{{ openRequests().length }} {{ openRequests().length === 1 ? 'richiesta aperta' : 'richieste aperte' }}</button>
      </div>

      <section id="sec-cassetti" class="block" aria-label="Cassettiere">
        <h2>Cassettiere</h2>
        <app-drawers [areaId]="a.id" (changed)="reload()" />
      </section>

      <div class="trio">
        <section id="sec-regole" class="card" aria-label="Regole dell'area">
          <header><h2>Regole dell'area</h2><a routerLink="/regole">Tutte</a></header>
          @for (r of rules(); track r.id) {
            <p class="rule" [class.active]="r.stato === 'attiva'" [class.draft]="r.stato !== 'attiva'">
              @if (r.stato === 'attiva') { <span class="tick" aria-label="Attiva">✓</span> } @else { <span class="tag">{{ r.stato === 'bozza' ? 'Bozza' : 'Da definire' }}</span> }
              <span>{{ r.testo }}</span>
            </p>
          } @empty {
            <p class="muted">Nessuna regola per quest'area. Puoi collegarla dalla pagina Regole.</p>
          }
        </section>

        <section id="sec-idee" class="card" aria-label="Idee aperte">
          <header><h2>Idee aperte</h2><a routerLink="/idee" [queryParams]="{ nuova: 1, area: a.id }">Nuova idea qui</a></header>
          @for (i of openIdeas(); track i.id) {
            <a class="line" routerLink="/idee" [queryParams]="{ id: i.id }">
              <strong>{{ i.titolo }}</strong>
              <span class="meta">{{ statusLabel(i) }}{{ cost(i) }}{{ i.priorita ? ' · ' + priorityLabel(i) : '' }}</span>
            </a>
          } @empty {
            <p class="muted">Nessuna idea aperta.</p>
          }
        </section>

        <section id="sec-richieste" class="card" aria-label="Richieste">
          <header><h2>Richieste</h2><a routerLink="/richieste">Tutte</a></header>
          @for (r of openRequests(); track r.id) {
            <div class="line req">
              <a routerLink="/richieste" [queryParams]="{ id: r.id }"><strong>{{ r.titolo }}</strong>
                <span class="meta">{{ requestStatus(r) }}{{ r.richiedente ? ' · ' + r.richiedente : '' }}</span></a>
              @if (r.stato === 'in_corso') {
                <button type="button" class="act" (click)="setRequest(r, 'fatta')">Fatta</button>
              } @else {
                <button type="button" class="act" (click)="setRequest(r, 'in_corso')">Prendi in carico</button>
              }
            </div>
          } @empty {
            <p class="muted">Nessuna richiesta aperta.</p>
          }
          @if (recentRequests().length) {
            <h3>Chiuse di recente</h3>
            @for (r of recentRequests(); track r.id) {
              <a class="line" routerLink="/richieste" [queryParams]="{ id: r.id }"><strong>{{ r.titolo }}</strong><span class="meta">{{ requestStatus(r) }}</span></a>
            }
          }
        </section>
      </div>
    } @else {
      <p class="muted">Caricamento…</p>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 16px; font-family: Inter, system-ui, sans-serif; }
    .muted { color: #5a5c53; margin: 0; }
    .error { margin: 0; color: #b42318; }
    .crumbs { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 13px; color: #5a5c53; }
    .back { padding: 6px 12px; border: 1px solid #cfc9bb; border-radius: 999px; color: #22241f; font-weight: 600; text-decoration: none; background: #fff; }
    .head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
    h1 { margin: 0; font: 800 30px 'Plus Jakarta Sans', Inter, sans-serif; }
    h2 { margin: 0; font: 800 17px 'Plus Jakarta Sans', Inter, sans-serif; }
    h3 { margin: 6px 0 0; font-size: 13px; color: #45473f; }
    .buttons { display: flex; gap: 8px; align-items: flex-start; }
    .btn { height: 44px; padding: 0 18px; border: 1.5px solid #2e6a4f; border-radius: 999px; background: #fff; color: #173d2b; font: 700 14px Inter, system-ui, sans-serif; cursor: pointer; }
    .btn.primary, .btn.ok { background: #2e6a4f; color: #fff; }
    .btn.small { height: 36px; padding: 0 12px; font-size: 13px; }
    .rename { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .edit { height: 44px; padding: 0 12px; border: 1px solid #cfc9bb; border-radius: 12px; font: 700 20px Inter, system-ui, sans-serif; }
    .addwrap { position: relative; }
    .menu { position: absolute; right: 0; top: 50px; z-index: 5; min-width: 160px; background: #fff; border-radius: 14px; box-shadow: 0 6px 24px rgba(40, 35, 20, .2); padding: 6px; display: flex; flex-direction: column; }
    .menu a { padding: 10px 12px; border-radius: 8px; color: #22241f; text-decoration: none; font-size: 14px; }
    .menu a:hover { background: #f3f0e9; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip { height: 36px; padding: 0 14px; border-radius: 999px; border: 1px solid #cfc9bb; background: #fff; color: #22241f; font: 600 13px Inter, system-ui, sans-serif; cursor: pointer; }
    .chip.dashed { border-style: dashed; }
    .block { display: flex; flex-direction: column; gap: 10px; }
    .trio { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; align-items: start; }
    .card { background: #fff; border-radius: 20px; padding: 16px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
    .card > header { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .card > header a { font-size: 13px; font-weight: 600; color: #245a41; }
    .rule { display: flex; gap: 10px; align-items: flex-start; margin: 0; padding: 10px; border-radius: 12px; font-size: 14px; line-height: 1.4; border: 1px solid transparent; }
    .rule.active { background: #edf5f0; }
    .rule.draft { border: 1.5px dashed #9a9c92; }
    .tick { display: inline-flex; flex: none; width: 20px; height: 20px; border-radius: 999px; background: #2e6a4f; color: #fff; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
    .tag { flex: none; padding: 2px 8px; border-radius: 999px; background: #efebe3; font-size: 12px; font-weight: 700; }
    .line { display: flex; flex-direction: column; gap: 2px; padding: 9px 0; border-top: 1px solid #f0ece2; color: #22241f; text-decoration: none; font-size: 14px; }
    .line:first-of-type { border-top: 0; }
    .line.req { flex-direction: row; justify-content: space-between; align-items: center; gap: 8px; }
    .line.req a { display: flex; flex-direction: column; gap: 2px; color: inherit; text-decoration: none; min-width: 0; }
    .meta { font-size: 12px; color: #5a5c53; }
    .act { flex: none; height: 34px; padding: 0 12px; border: 1px solid #2e6a4f; border-radius: 999px; background: #fff; color: #173d2b; font: 700 12px Inter, system-ui, sans-serif; cursor: pointer; }
    a:focus-visible, button:focus-visible, input:focus-visible { outline: 3px solid #2f6fb5; outline-offset: 2px; }
    @media (max-width: 800px) { h1 { font-size: 26px; } }
  `,
})
export class AreaDetail {
  /** Bound from the route (`withComponentInputBinding`). */
  readonly id = input.required<string>();

  private readonly areasService = inject(AreasService);
  private readonly unitsService = inject(DrawerUnitsService);
  private readonly drawersService = inject(DrawersService);
  private readonly ideasService = inject(IdeasService);
  private readonly requestsService = inject(RequestsService);
  private readonly rulesService = inject(RulesService);

  readonly area = signal<Area | null>(null);
  readonly missing = signal(false);
  readonly error = signal('');
  readonly editing = signal(false);
  readonly addOpen = signal(false);
  editName = '';

  private readonly allRules = signal<Rule[]>([]);
  private readonly ideas = signal<Idea[]>([]);
  private readonly requests = signal<WorkRequest[]>([]);
  private readonly units = signal<DrawerUnit[]>([]);
  private readonly drawers = signal<Drawer[]>([]);

  readonly rules = computed(() => {
    const order = { attiva: 0, bozza: 1, da_definire: 2 } as const;
    return this.allRules().filter((r) => r.area === this.id()).sort((a, b) => order[a.stato] - order[b.stato]);
  });
  readonly openIdeas = computed(() => this.ideas().filter((i) => i.area === this.id() && !CLOSED_IDEAS.includes(i.stato)));
  readonly openRequests = computed(() => this.requests().filter((r) => r.area === this.id() && OPEN_REQUESTS.includes(r.stato)));
  readonly recentRequests = computed(() =>
    this.requests().filter((r) => r.area === this.id() && !OPEN_REQUESTS.includes(r.stato)).sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 5),
  );
  private readonly myDrawers = computed(() => {
    const ids = new Set(this.units().filter((u) => u.area === this.id()).map((u) => u.id));
    return this.drawers().filter((d) => ids.has(d.cassettiera));
  });
  readonly occupied = computed(() => this.myDrawers().filter((d) => d.tipo !== 'libero').length);
  readonly free = computed(() => this.myDrawers().filter((d) => d.tipo === 'libero').length);

  constructor() {
    effect(() => {
      const id = this.id();
      void this.load(id);
    });
  }

  private async load(id: string): Promise<void> {
    this.missing.set(false);
    this.error.set('');
    try {
      const area = await this.areasService.get(id);
      const [rules, ideas, requests, units, drawers] = await Promise.all([
        this.rulesService.list(),
        this.ideasService.list(),
        this.requestsService.list(),
        this.unitsService.list(),
        this.drawersService.list(),
      ]);
      this.area.set(area);
      this.allRules.set(rules);
      this.ideas.set(ideas);
      this.requests.set(requests);
      this.units.set(units);
      this.drawers.set(drawers);
    } catch {
      this.area.set(null);
      this.missing.set(true);
    }
  }

  /** Called when the drawers section changes something. */
  async reload(): Promise<void> {
    try {
      const [units, drawers] = await Promise.all([this.unitsService.list(), this.drawersService.list()]);
      this.units.set(units);
      this.drawers.set(drawers);
    } catch {
      // The counters are a convenience.
    }
  }

  go(sectionId: string): void {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  startRename(): void {
    this.editName = this.area()?.nome ?? '';
    this.editing.set(true);
    setTimeout(() => document.querySelector<HTMLInputElement>('input.edit')?.select());
  }

  async saveName(): Promise<void> {
    const a = this.area();
    const name = this.editName.trim();
    if (!a) return;
    if (!name || name === a.nome) {
      this.editing.set(false);
      return;
    }
    try {
      this.area.set(await this.areasService.rename(a.id, name));
      this.editing.set(false);
      this.error.set('');
    } catch {
      this.error.set(`Impossibile rinominare in "${name}": esiste già un'area con questo nome.`);
    }
  }

  async setRequest(r: WorkRequest, stato: 'in_corso' | 'fatta'): Promise<void> {
    try {
      const saved = await this.requestsService.update(r.id, { stato });
      this.requests.update((list) => list.map((x) => (x.id === r.id ? saved : x)));
    } catch {
      this.error.set('Impossibile aggiornare la richiesta.');
    }
  }

  statusLabel(i: Idea): string {
    return labelOf(IDEA_STATUSES, i.stato);
  }

  priorityLabel(i: Idea): string {
    return 'urgenza ' + labelOf(IDEA_PRIORITIES, i.priorita).toLowerCase();
  }

  requestStatus(r: WorkRequest): string {
    return labelOf(REQUEST_STATUSES, r.stato);
  }

  cost(i: Idea): string {
    if (!i.costo_min && !i.costo_max) return '';
    return ` · € ${i.costo_min || 0}${i.costo_max && i.costo_max !== i.costo_min ? '–' + i.costo_max : ''}`;
  }
}
