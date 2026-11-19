import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MasterDetail } from '../../core/ui/master-detail';
import { PageHead } from '../../core/ui/page-head';
import { NEW_ID, pinFirstSelection, selectedIdFromUrl, selectItem } from '../../core/ui/selection';
import { watchPageParams } from '../../core/page-params';
import { Area, Idea, REQUEST_STATUSES, RequestEvent, RequestStatus, WorkRequest, labelOf } from '../../models/models';
import { AreasService } from '../../services/areas.service';
import { diffDays, shortDay, todayDay, toDay, toStored, weekdayName } from '../../services/dates';
import { IdeasService } from '../../services/ideas.service';
import { RequestEventsService } from '../../services/request-events.service';
import { RequestsService } from '../../services/requests.service';

type Tab = 'aperte' | 'chiuse' | 'tutte';
const OPEN: RequestStatus[] = ['ricevuta', 'in_valutazione', 'in_corso'];
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

interface Draft {
  titolo: string;
  richiedente: string;
  data: string;
  area: string;
  descrizione: string;
}

import { ConfirmService } from '../../services/confirm.service';

@Component({
  selector: 'app-requests',
  imports: [FormsModule, NgTemplateOutlet, RouterLink, MatIconModule, MasterDetail, PageHead],
  template: `
    <app-page-head title="Richieste">
      <button type="button" class="btn btn-primary" (click)="startNew()"><mat-icon aria-hidden="true">add</mat-icon> Nuova richiesta</button>
    </app-page-head>

    <app-master-detail listLabel="Elenco richieste" detailLabel="Dettaglio richiesta">
      <ng-container list>
        <div role="tablist" aria-label="Filtra per stato" class="md-tabs">
          <button type="button" role="tab" class="md-tab" [attr.aria-selected]="tab() === 'aperte'" (click)="tab.set('aperte')">Aperte {{ openCount() }}</button>
          <button type="button" role="tab" class="md-tab" [attr.aria-selected]="tab() === 'chiuse'" (click)="tab.set('chiuse')">Chiuse {{ closedCount() }}</button>
          <button type="button" role="tab" class="md-tab" [attr.aria-selected]="tab() === 'tutte'" (click)="tab.set('tutte')">Tutte</button>
        </div>
        <label class="md-search">
          <mat-icon aria-hidden="true">search</mat-icon>
          <span class="sr-only">Cerca per titolo o collega</span>
          <input type="search" placeholder="Cerca per titolo o collega" [ngModel]="search()" (ngModelChange)="search.set($event)" />
        </label>

        @for (r of visible(); track r.id) {
          <a class="md-item" [class.sel]="r.id === current()?.id" role="button" tabindex="0" (click)="select(r.id)" (keydown.enter)="select(r.id)" [attr.aria-current]="r.id === current()?.id ? 'true' : null">
            <span class="grow">
              <span class="row"><strong class="t">{{ r.titolo }}</strong><span [class]="'md-chip small ' + tone(r)">{{ shortStatus(r) }}</span></span>
              <span class="s">{{ listSub(r) }}</span>
            </span>
          </a>
        } @empty {
          <p class="md-empty">{{ search() ? 'Nessuna richiesta trovata.' : 'Nessuna richiesta in questa vista.' }}</p>
        }

        @if (tab() === 'aperte' && recentlyClosed().length) {
          <div class="md-box">
            <strong>Ultime chiuse</strong>
            @for (r of recentlyClosed(); track r.id) {
              <span>{{ r.titolo }} · {{ r.stato === 'fatta' ? 'fatta' : 'non fattibile' }} il {{ shortDay(toDay(r['updated'])) }}</span>
            }
          </div>
        }
      </ng-container>

      <ng-container detail>
        @if (isNew()) {
          <div class="md-head"><div><h2 class="md-title">Nuova richiesta</h2></div></div>
          <ng-container *ngTemplateOutlet="form" />
          <div class="md-actions">
            <button type="button" class="btn btn-primary" [disabled]="!draft.titolo.trim() || busy()" (click)="create()">Crea richiesta</button>
            <button type="button" class="btn btn-ghost" (click)="select(null)">Annulla</button>
          </div>
        } @else if (current(); as r) {
          <div class="md-head">
            <div>
              <span [class]="'md-chip ' + tone(r)">{{ labelOf(statuses, r.stato) }}</span>
              <h2 class="md-title">{{ r.titolo }}</h2>
            </div>
            <button type="button" class="icon-btn" aria-label="Modifica richiesta" (click)="startEdit(r)"><mat-icon aria-hidden="true">edit</mat-icon></button>
          </div>

          @if (editing()) {
            <ng-container *ngTemplateOutlet="form" />
            <div class="md-actions">
              <button type="button" class="btn btn-primary" [disabled]="!draft.titolo.trim() || busy()" (click)="saveEdit(r)">Salva</button>
              <button type="button" class="btn btn-outline" (click)="editing.set(false)">Annulla</button>
              <button type="button" class="btn btn-ghost btn-danger-text push" (click)="remove(r)">Elimina richiesta</button>
            </div>
          } @else {
            <dl class="md-facts">
              <div class="md-fact"><dt>RICHIEDENTE</dt><dd>{{ r.richiedente || '—' }}</dd></div>
              <div class="md-fact"><dt>AREA</dt><dd>{{ r.expand?.area?.nome || '—' }}</dd></div>
              <div class="md-fact"><dt>RICEVUTA</dt><dd>{{ receivedLabel(r) }}</dd></div>
              <div class="md-fact">
                <dt>IDEA COLLEGATA</dt>
                <dd>
                  @if (r.expand?.idea; as idea) {
                    <a [routerLink]="['/idee']" [queryParams]="{ id: idea.id }">{{ idea.titolo }}</a>
                  } @else {
                    <select class="inline-select" aria-label="Collega a un'idea" (change)="linkIdea(r, $any($event.target).value)">
                      <option value="">Collega…</option>
                      @for (i of ideas(); track i.id) { <option [value]="i.id">{{ i.titolo }}</option> }
                    </select>
                  }
                </dd>
              </div>
            </dl>

            @if (r.descrizione) { <p class="md-text">{{ r.descrizione }}</p> }

            <div>
              <h3 class="md-h3">Cronologia</h3>
              <ol class="md-timeline">
                @for (e of events(); track e.id; let last = $last) {
                  <li>
                    <span class="rail"><i [style.opacity]="opacity($index)"></i>@if (!last) { <b></b> }</span>
                    <span class="body"><strong>{{ e.tipo === 'nota' ? 'Nota: ' + e.testo : e.testo }}</strong><span>{{ eventDay(e) }}</span></span>
                  </li>
                } @empty {
                  <li><span class="body"><span>Nessun evento registrato.</span></span></li>
                }
              </ol>
            </div>

            <form class="md-inline-add" (ngSubmit)="addNote(r)">
              <span class="sr-only" id="nota-label">Aggiungi una nota</span>
              <input type="text" name="nota" aria-labelledby="nota-label" placeholder="Aggiungi una nota…" [(ngModel)]="note" />
              <button type="submit" class="btn btn-soft" [disabled]="busy()">Aggiungi</button>
            </form>

            @if (error()) { <p class="md-error" role="alert">{{ error() }}</p> }

            <div class="md-actions">
              @switch (r.stato) {
                @case ('in_corso') {
                  <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="setStatus(r, 'fatta')"><mat-icon aria-hidden="true">check</mat-icon> Segna come fatta</button>
                }
                @case ('ricevuta') {
                  <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="setStatus(r, 'in_corso')">Prendi in carico</button>
                  <button type="button" class="btn btn-outline" [disabled]="busy()" (click)="setStatus(r, 'fatta')">Segna come fatta</button>
                }
                @case ('in_valutazione') {
                  <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="setStatus(r, 'in_corso')">Prendi in carico</button>
                  <button type="button" class="btn btn-outline" [disabled]="busy()" (click)="setStatus(r, 'fatta')">Segna come fatta</button>
                }
                @default {
                  <button type="button" class="btn btn-outline" [disabled]="busy()" (click)="setStatus(r, 'in_corso')">Riapri</button>
                }
              }
              @if (!r.idea) {
                <button type="button" class="btn btn-outline" [disabled]="busy()" (click)="toIdea(r)">Trasforma in idea</button>
              }
              @if (isOpen(r)) {
                <button type="button" class="btn btn-ghost push" [disabled]="busy()" (click)="setStatus(r, 'non_fattibile')">Non fattibile</button>
              }
            </div>
          }
        } @else {
          <p class="md-empty">Nessuna richiesta selezionata.</p>
        }
      </ng-container>
    </app-master-detail>

    <ng-template #form>
      <div class="md-form">
        <label class="md-field wide"><span>Titolo</span><input type="text" name="titolo" [(ngModel)]="draft.titolo" required /></label>
        <label class="md-field"><span>Richiedente</span><input type="text" name="richiedente" [(ngModel)]="draft.richiedente" /></label>
        <label class="md-field"><span>Data</span><input type="date" name="data" [(ngModel)]="draft.data" /></label>
        <label class="md-field wide">
          <span>Area</span>
          <select name="area" [(ngModel)]="draft.area">
            <option value="">(nessuna)</option>
            @for (a of areas(); track a.id) { <option [value]="a.id">{{ a.nome }}</option> }
          </select>
        </label>
        <label class="md-field wide"><span>Descrizione</span><textarea name="descrizione" rows="4" [(ngModel)]="draft.descrizione"></textarea></label>
      </div>
      @if (error()) { <p class="md-error" role="alert">{{ error() }}</p> }
    </ng-template>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 20px; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .md-item { flex-direction: column; align-items: stretch; gap: 8px; }
    .inline-select { max-width: 100%; border: 0; background: transparent; font: 600 14px Inter, system-ui, sans-serif; color: #245a41; cursor: pointer; padding: 0; }
    a { color: #245a41; font-weight: 600; text-decoration: none; }
    .md-item .row .t { white-space: normal; }
  `,
})
export class Requests implements OnInit {
  private readonly confirmService = inject(ConfirmService);
  private readonly requestsService = inject(RequestsService);
  private readonly eventsService = inject(RequestEventsService);
  private readonly areasService = inject(AreasService);
  private readonly ideasService = inject(IdeasService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly statuses = REQUEST_STATUSES;
  readonly labelOf = labelOf;
  readonly shortDay = shortDay;
  readonly toDay = toDay;

  readonly requests = signal<WorkRequest[]>([]);
  readonly areas = signal<Area[]>([]);
  readonly ideas = signal<Idea[]>([]);
  readonly events = signal<RequestEvent[]>([]);
  readonly tab = signal<Tab>('aperte');
  readonly search = signal('');
  readonly editing = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  note = '';
  draft: Draft = this.emptyDraft();

  private readonly selectedId = selectedIdFromUrl(this.route);
  readonly isNew = computed(() => this.selectedId() === NEW_ID);

  readonly openCount = computed(() => this.requests().filter((r) => this.isOpen(r)).length);
  readonly closedCount = computed(() => this.requests().length - this.openCount());
  readonly visible = computed(() => {
    const q = this.search().trim().toLowerCase();
    const tab = this.tab();
    const list = this.requests().filter(
      (r) =>
        (tab === 'tutte' || (tab === 'aperte') === this.isOpen(r)) &&
        (!q || (r.titolo + ' ' + r.richiedente).toLowerCase().includes(q)),
    );
    // Open ones: the longest waiting first; closed ones: the latest first.
    const day = (r: WorkRequest) => String(r.data || r['created']);
    if (tab === 'aperte') list.sort((a, b) => day(a).localeCompare(day(b)));
    else if (tab === 'chiuse') list.sort((a, b) => String(b['updated']).localeCompare(String(a['updated'])));
    return list;
  });
  readonly recentlyClosed = computed(() =>
    this.requests()
      .filter((r) => !this.isOpen(r))
      .sort((a, b) => String(b['updated']).localeCompare(String(a['updated'])))
      .slice(0, 2),
  );

  /** The request shown on the right: the one in the URL, else the first of the list. */
  readonly current = computed(() => {
    if (this.isNew()) return null;
    const id = this.selectedId();
    return this.requests().find((r) => r.id === id) ?? this.visible()[0] ?? null;
  });

  constructor() {
    pinFirstSelection(this.router, this.selectedId, computed(() => this.visible()[0]?.id));
    // Reload the history whenever another request is shown.
    effect(() => {
      const id = this.current()?.id;
      untracked(() => {
        this.editing.set(false);
        this.error.set('');
        this.note = '';
        void this.loadEvents(id);
      });
    });
    // A link to a closed request (from the dashboard or the search) switches to the right tab.
    effect(() => {
      const id = this.selectedId();
      const r = this.requests().find((x) => x.id === id);
      if (r) untracked(() => this.tab.set(this.isOpen(r) ? 'aperte' : 'chiuse'));
    });
  }

  async ngOnInit(): Promise<void> {
    const [requests, areas, ideas] = await Promise.all([
      this.requestsService.list(),
      this.areasService.list(),
      this.ideasService.list(),
    ]);
    this.requests.set(requests);
    this.areas.set(areas);
    this.ideas.set(ideas);
    watchPageParams(this.route, this.router, this.destroyRef, {
      onNew: (area) => this.startNew(area),
      onSearch: (q) => {
        this.search.set(q);
        this.tab.set('tutte');
      },
    });
  }

  // --- list ---------------------------------------------------------------------------------
  isOpen(r: WorkRequest): boolean {
    return OPEN.includes(r.stato);
  }

  select(id: string | null): void {
    selectItem(this.router, id);
  }

  tone(r: WorkRequest): string {
    return r.stato === 'ricevuta' ? 'warn' : r.stato === 'fatta' || r.stato === 'non_fattibile' ? 'mute' : 'ok';
  }

  shortStatus(r: WorkRequest): string {
    return r.stato === 'ricevuta' ? 'Nuova' : labelOf(REQUEST_STATUSES, r.stato);
  }

  private since(r: WorkRequest): string {
    const d = diffDays(toDay(r.data || String(r['created'])), todayDay());
    return d <= 0 ? 'oggi' : `da ${plural(d, 'giorno', 'giorni')}`;
  }

  listSub(r: WorkRequest): string {
    return [r.richiedente, r.expand?.area?.nome, this.since(r)].filter(Boolean).join(' · ');
  }

  receivedLabel(r: WorkRequest): string {
    const day = toDay(r.data || String(r['created']));
    return `${weekdayName(day)} ${shortDay(day)}`;
  }

  // --- history ------------------------------------------------------------------------------
  private async loadEvents(id: string | undefined): Promise<void> {
    this.events.set(id ? await this.eventsService.list(id) : []);
  }

  eventDay(e: RequestEvent): string {
    const day = toDay(e.data);
    return `${weekdayName(day)} ${shortDay(day)}`;
  }

  /** The newest event is the darkest dot. */
  opacity(index: number): number {
    return Math.max(0.35, 1 - index * 0.25);
  }

  async addNote(r: WorkRequest): Promise<void> {
    const text = this.note.trim();
    if (!text || this.busy()) return;
    this.busy.set(true);
    try {
      await this.eventsService.addNote(r.id, text);
      this.note = '';
      await this.loadEvents(r.id);
    } catch {
      this.error.set('Impossibile aggiungere la nota.');
    } finally {
      this.busy.set(false);
    }
  }

  // --- actions ------------------------------------------------------------------------------
  private replace(updated: WorkRequest): void {
    this.requests.update((list) => list.map((x) => (x.id === updated.id ? updated : x)));
  }

  async setStatus(r: WorkRequest, status: RequestStatus): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      this.replace(await this.requestsService.update(r.id, { stato: status }));
      await this.loadEvents(r.id);
    } catch {
      this.error.set('Impossibile cambiare lo stato.');
    } finally {
      this.busy.set(false);
    }
  }

  async linkIdea(r: WorkRequest, ideaId: string): Promise<void> {
    if (!ideaId || this.busy()) return;
    this.busy.set(true);
    try {
      this.replace(await this.requestsService.update(r.id, { idea: ideaId }));
    } finally {
      this.busy.set(false);
    }
  }

  /** Turns the request into an idea (same title, description and area) and links the two. */
  async toIdea(r: WorkRequest): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const idea = await this.ideasService.create({ titolo: r.titolo, descrizione: r.descrizione, area: r.area, stato: 'idea' });
      this.ideas.update((list) => [idea, ...list]);
      this.replace(await this.requestsService.update(r.id, { idea: idea.id }));
    } catch {
      this.error.set("Impossibile creare l'idea.");
    } finally {
      this.busy.set(false);
    }
  }

  async remove(r: WorkRequest): Promise<void> {
    if (this.busy()) return;
    if (!(await this.confirmService.ask({ title: `Eliminare la richiesta «${r.titolo}»?`, text: 'La richiesta non sarà più recuperabile.', confirmLabel: 'Elimina richiesta' }))) return;
    this.busy.set(true);
    try {
      await this.requestsService.remove(r.id);
      this.requests.update((list) => list.filter((x) => x.id !== r.id));
      this.select(null);
    } finally {
      this.busy.set(false);
    }
  }

  // --- create and edit ----------------------------------------------------------------------
  private emptyDraft(): Draft {
    return { titolo: '', richiedente: '', data: todayDay(), area: '', descrizione: '' };
  }

  startNew(area = ''): void {
    this.draft = { ...this.emptyDraft(), area };
    this.error.set('');
    this.select(NEW_ID);
  }

  startEdit(r: WorkRequest): void {
    this.draft = {
      titolo: r.titolo,
      richiedente: r.richiedente ?? '',
      data: r.data ? toDay(r.data) : todayDay(),
      area: r.area ?? '',
      descrizione: r.descrizione ?? '',
    };
    this.error.set('');
    this.editing.set(true);
  }

  private payload(): Partial<WorkRequest> {
    const d = this.draft;
    return {
      titolo: d.titolo.trim(),
      richiedente: d.richiedente.trim(),
      data: d.data ? toStored(d.data) : '',
      area: d.area,
      descrizione: d.descrizione,
    };
  }

  async create(): Promise<void> {
    if (this.busy() || !this.draft.titolo.trim()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const created = await this.requestsService.create({ ...this.payload(), stato: 'ricevuta' });
      this.requests.update((list) => [created, ...list]);
      this.tab.set('aperte');
      this.select(created.id);
    } catch {
      this.error.set('Impossibile creare la richiesta.');
    } finally {
      this.busy.set(false);
    }
  }

  async saveEdit(r: WorkRequest): Promise<void> {
    if (this.busy() || !this.draft.titolo.trim()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      this.replace(await this.requestsService.update(r.id, this.payload()));
      this.editing.set(false);
    } catch {
      this.error.set('Impossibile salvare la richiesta.');
    } finally {
      this.busy.set(false);
    }
  }
}
