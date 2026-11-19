import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MasterDetail } from '../../core/ui/master-detail';
import { PageHead } from '../../core/ui/page-head';
import { NEW_ID, pinFirstSelection, selectedIdFromUrl, selectItem } from '../../core/ui/selection';
import { StepsBar } from '../../core/ui/steps-bar';
import { watchPageParams } from '../../core/page-params';
import { Area, Idea, PURCHASE_STATUSES, Purchase, PurchaseStatus, labelOf } from '../../models/models';
import { AreasService } from '../../services/areas.service';
import { shortDay, toDay, todayDay, toStored } from '../../services/dates';
import { IdeasService } from '../../services/ideas.service';
import { PurchasesService } from '../../services/purchases.service';

type Tab = 'incorso' | 'montati' | 'tutti';

/** Next step of a purchase, with the label of the button that takes it there. */
const NEXT: Partial<Record<PurchaseStatus, { to: PurchaseStatus; label: string }>> = {
  da_proporre: { to: 'approvato', label: 'Segna come approvato' },
  approvato: { to: 'ordinato', label: 'Segna come ordinato' },
  ordinato: { to: 'arrivato', label: 'Segna come arrivato' },
  arrivato: { to: 'montato', label: 'Segna come montato' },
};

/** Groups of the list, in the order they are shown. */
const GROUPS: { status: PurchaseStatus; label: string; tone: string }[] = [
  { status: 'arrivato', label: 'DA MONTARE', tone: 'ok' },
  { status: 'ordinato', label: 'IN ARRIVO', tone: '' },
  { status: 'approvato', label: 'DA ORDINARE', tone: 'warn' },
  { status: 'da_proporre', label: 'DA PROPORRE', tone: '' },
  { status: 'montato', label: 'MONTATI', tone: '' },
];

const eur = (n: number) => '€ ' + n.toLocaleString('it-IT', { maximumFractionDigits: 2 });

interface Draft {
  articolo: string;
  quantita: number | null;
  area: string;
  fornitore: string;
  link: string;
  stimaMin: number | null;
  stimaMax: number | null;
  prezzo: number | null;
  stato: PurchaseStatus;
  idea: string;
}

@Component({
  selector: 'app-purchases',
  imports: [FormsModule, NgTemplateOutlet, RouterLink, MatIconModule, MasterDetail, PageHead, StepsBar],
  template: `
    <app-page-head title="Acquisti">
      <button type="button" class="btn btn-primary" (click)="startNew()"><mat-icon aria-hidden="true">add</mat-icon> Nuovo acquisto</button>
    </app-page-head>

    <section class="budget" aria-label="Budget">
      <div><span>Speso</span><strong>{{ eur(totals().received) }}</strong></div>
      <div><span>Già ordinato, da pagare</span><strong>{{ eur(totals().ordered) }}</strong></div>
      <div><span>Ancora da decidere (stima)</span><strong>{{ undecided() }}</strong></div>
      <div class="bar" role="img" aria-label="Speso, ordinato e stimato a confronto">
        <i class="spent" [style.flex]="totals().received || 0"></i>
        <i class="ordered" [style.flex]="totals().ordered || 0"></i>
        <i class="undecided" [style.flex]="totals().undecidedMax || 0"></i>
      </div>
    </section>

    <app-master-detail listLabel="Elenco acquisti" detailLabel="Dettaglio acquisto">
      <ng-container list>
        <div role="tablist" aria-label="Filtra" class="md-tabs">
          <button type="button" role="tab" class="md-tab" [attr.aria-selected]="tab() === 'incorso'" (click)="tab.set('incorso')">In corso {{ activeCount() }}</button>
          <button type="button" role="tab" class="md-tab" [attr.aria-selected]="tab() === 'montati'" (click)="tab.set('montati')">Montati {{ doneCount() }}</button>
          <button type="button" role="tab" class="md-tab" [attr.aria-selected]="tab() === 'tutti'" (click)="tab.set('tutti')">Tutti</button>
        </div>

        @for (g of groups(); track g.status) {
          <span [class]="'md-label ' + g.tone">{{ g.label }}</span>
          @for (p of g.items; track p.id) {
            <a class="md-item" [class.sel]="p.id === current()?.id" role="button" tabindex="0" (click)="select(p.id)" (keydown.enter)="select(p.id)" [attr.aria-current]="p.id === current()?.id ? 'true' : null">
              <span class="grow"><strong class="t">{{ title(p) }}</strong><span class="s">{{ listSub(p) }}</span></span>
              <strong class="price" [class.range]="!p.prezzo_effettivo && p.stato !== 'ordinato'">{{ listPrice(p) }}</strong>
            </a>
          }
        } @empty {
          <p class="md-empty">Nessun acquisto in questa vista.</p>
        }
      </ng-container>

      <ng-container detail>
        @if (isNew()) {
          <div class="md-head"><div><h2 class="md-title">Nuovo acquisto</h2></div></div>
          <ng-container *ngTemplateOutlet="form" />
          <div class="md-actions">
            <button type="button" class="btn btn-primary" [disabled]="!draft.articolo.trim() || busy()" (click)="create()">Crea acquisto</button>
            <button type="button" class="btn btn-ghost" (click)="select(null)">Annulla</button>
          </div>
        } @else if (current(); as p) {
          <div class="md-head">
            <div>
              <span [class]="'md-chip ' + chipTone(p)">{{ chipText(p) }}</span>
              <h2 class="md-title">{{ title(p) }}</h2>
            </div>
            <button type="button" class="icon-btn" aria-label="Modifica acquisto" (click)="startEdit(p)"><mat-icon aria-hidden="true">edit</mat-icon></button>
          </div>

          @if (editing()) {
            <ng-container *ngTemplateOutlet="form" />
            <div class="md-actions">
              <button type="button" class="btn btn-primary" [disabled]="!draft.articolo.trim() || busy()" (click)="saveEdit(p)">Salva</button>
              <button type="button" class="btn btn-outline" (click)="editing.set(false)">Annulla</button>
            </div>
          } @else {
            <app-steps-bar [steps]="steps" [current]="p.stato" label="Avanzamento" />

            <dl class="md-facts">
              <div class="md-fact"><dt>STIMA</dt><dd>{{ estimate(p) }}</dd></div>
              <div class="md-fact" [class.green]="!!p.prezzo_effettivo">
                <dt>PREZZO PAGATO</dt>
                <dd>@if (p.prezzo_effettivo) { <strong>{{ eur(p.prezzo_effettivo) }}</strong> <small [class.over]="vsEstimate(p) === 'sopra la stima'">{{ vsEstimate(p) }}</small> } @else { — }</dd>
              </div>
              <div class="md-fact">
                <dt>FORNITORE</dt>
                <dd>@if (p.link) { <a [href]="p.link" target="_blank" rel="noopener">{{ p.fornitore || 'Apri il link' }} ↗</a> } @else { {{ p.fornitore || '—' }} }</dd>
              </div>
              <div class="md-fact"><dt>AREA</dt><dd>{{ p.expand?.area?.nome || '—' }}</dd></div>
            </dl>

            @if (p.expand?.idea; as idea) {
              <a class="md-link-card" [routerLink]="['/idee']" [queryParams]="{ id: idea.id }">
                <mat-icon aria-hidden="true">lightbulb</mat-icon>
                <span class="grow"><span>Nato dall'idea</span><strong>{{ idea.titolo }}</strong></span>
                <mat-icon aria-hidden="true">chevron_right</mat-icon>
              </a>
            }

            @if (error()) { <p class="md-error" role="alert">{{ error() }}</p> }

            <div class="md-actions">
              @if (next(p); as n) {
                @if ((n.to === 'ordinato' || n.to === 'arrivato') && !p.prezzo_effettivo) {
                  <label class="price-in"><span class="sr-only">Prezzo pagato in euro</span><input type="number" min="0" step="0.01" name="prezzoPagato" placeholder="Prezzo pagato €" [(ngModel)]="paid" /></label>
                }
                <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="advance(p, n.to)"><mat-icon aria-hidden="true">check</mat-icon> {{ n.label }}</button>
              }
              @if (p.link) { <a class="btn btn-outline" [href]="p.link" target="_blank" rel="noopener">Apri il link</a> }
              <button type="button" class="btn btn-ghost btn-danger-text push" [disabled]="busy()" (click)="remove(p)">Annulla acquisto</button>
            </div>
          }
        } @else {
          <p class="md-empty">Nessun acquisto selezionato.</p>
        }
      </ng-container>
    </app-master-detail>

    <ng-template #form>
      <div class="md-form">
        <label class="md-field wide"><span>Articolo</span><input type="text" name="articolo" [(ngModel)]="draft.articolo" required /></label>
        <label class="md-field"><span>Quantità</span><input type="number" min="1" name="quantita" [(ngModel)]="draft.quantita" /></label>
        <label class="md-field">
          <span>Area</span>
          <select name="area" [(ngModel)]="draft.area">
            <option value="">(nessuna)</option>
            @for (a of areas(); track a.id) { <option [value]="a.id">{{ a.nome }}</option> }
          </select>
        </label>
        <label class="md-field"><span>Fornitore</span><input type="text" name="fornitore" [(ngModel)]="draft.fornitore" /></label>
        <label class="md-field"><span>Link</span><input type="url" name="link" placeholder="https://…" [(ngModel)]="draft.link" /></label>
        <label class="md-field"><span>Stima minima (€)</span><input type="number" min="0" name="stimaMin" [(ngModel)]="draft.stimaMin" /></label>
        <label class="md-field"><span>Stima massima (€)</span><input type="number" min="0" name="stimaMax" [(ngModel)]="draft.stimaMax" /></label>
        <label class="md-field"><span>Prezzo pagato (€)</span><input type="number" min="0" step="0.01" name="prezzo" [(ngModel)]="draft.prezzo" /></label>
        <label class="md-field">
          <span>Stato</span>
          <select name="stato" [(ngModel)]="draft.stato">
            @for (s of statuses; track s.value) { <option [value]="s.value">{{ s.label }}</option> }
          </select>
        </label>
        <label class="md-field wide">
          <span>Idea di origine</span>
          <select name="idea" [(ngModel)]="draft.idea">
            <option value="">(nessuna)</option>
            @for (i of ideas(); track i.id) { <option [value]="i.id">{{ i.titolo }}</option> }
          </select>
        </label>
      </div>
      <p class="md-hint">Stime e prezzo sono totali della riga, quantità già compresa.</p>
      @if (error()) { <p class="md-error" role="alert">{{ error() }}</p> }
    </ng-template>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 20px; }
    .budget { padding: 18px 22px; border-radius: 24px; background: #fff; display: flex; flex-wrap: wrap; align-items: center; gap: 24px; }
    .budget > div:not(.bar) { display: flex; flex-direction: column; gap: 2px; }
    .budget span { font-size: 12px; color: #55584f; }
    .budget strong { font: 700 24px 'Plus Jakarta Sans', Inter, sans-serif; }
    .bar { flex: 1 1 260px; display: flex; height: 12px; border-radius: 999px; overflow: hidden; gap: 2px; }
    .bar i { display: block; min-width: 0; }
    .bar .spent { background: #2e6a4f; }
    .bar .ordered { background: #6fb08c; }
    .bar .undecided { background: repeating-linear-gradient(135deg, #dcebe2 0 6px, #edf5f0 6px 12px); }
    .price { font-size: 13px; white-space: nowrap; }
    .price.range { font-size: 12px; font-weight: 600; color: #45473f; }
    .md-fact small { font-weight: 500; font-size: 12px; color: #245a41; }
    .md-fact small.over { color: #9b1c12; }
    a { color: #245a41; font-weight: 600; text-decoration: none; }
    .md-link-card, .btn { text-decoration: none; }
    .md-link-card { color: #22241f; font-weight: 400; }
    .md-link-card mat-icon { color: #45473f; }
    .price-in input { width: 150px; height: 44px; box-sizing: border-box; padding: 0 14px; border: 1px solid #c9c3b6; border-radius: 999px; font: 14px Inter, system-ui, sans-serif; }
    .md-hint { margin: 0; font-size: 12px; color: #55584f; }
  `,
})
export class Purchases implements OnInit {
  private readonly purchasesService = inject(PurchasesService);
  private readonly areasService = inject(AreasService);
  private readonly ideasService = inject(IdeasService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly statuses = PURCHASE_STATUSES;
  readonly steps = PURCHASE_STATUSES;
  readonly eur = eur;

  readonly purchases = signal<Purchase[]>([]);
  readonly areas = signal<Area[]>([]);
  readonly ideas = signal<Idea[]>([]);
  readonly tab = signal<Tab>('incorso');
  readonly editing = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  paid: number | null = null;
  draft: Draft = this.emptyDraft();

  private readonly selectedId = selectedIdFromUrl(this.route);
  readonly isNew = computed(() => this.selectedId() === NEW_ID);
  readonly totals = computed(() => this.purchasesService.totals(this.purchases()));
  readonly activeCount = computed(() => this.purchases().filter((p) => p.stato !== 'montato').length);
  readonly doneCount = computed(() => this.purchases().filter((p) => p.stato === 'montato').length);

  readonly groups = computed(() => {
    const tab = this.tab();
    const wanted = (status: PurchaseStatus) => (tab === 'tutti' ? true : (tab === 'montati') === (status === 'montato'));
    return GROUPS.filter((g) => wanted(g.status))
      .map((g) => ({ ...g, items: this.purchases().filter((p) => p.stato === g.status) }))
      .filter((g) => g.items.length);
  });
  private readonly visible = computed(() => this.groups().flatMap((g) => g.items));

  readonly current = computed(() => {
    if (this.isNew()) return null;
    const id = this.selectedId();
    return this.purchases().find((p) => p.id === id) ?? this.visible()[0] ?? null;
  });

  constructor() {
    pinFirstSelection(this.router, this.selectedId, computed(() => this.visible()[0]?.id));
    effect(() => {
      this.current();
      untracked(() => {
        this.editing.set(false);
        this.error.set('');
        this.paid = null;
      });
    });
    // A link to a mounted purchase switches to the right tab.
    effect(() => {
      const p = this.purchases().find((x) => x.id === this.selectedId());
      if (p) untracked(() => this.tab.set(p.stato === 'montato' ? 'montati' : 'incorso'));
    });
  }

  async ngOnInit(): Promise<void> {
    const [purchases, areas, ideas] = await Promise.all([
      this.purchasesService.list(),
      this.areasService.list(),
      this.ideasService.list(),
    ]);
    this.purchases.set(purchases);
    this.areas.set(areas);
    this.ideas.set(ideas);
    watchPageParams(this.route, this.router, this.destroyRef, { onNew: () => this.startNew() });
  }

  // --- labels -------------------------------------------------------------------------------
  select(id: string | null): void {
    selectItem(this.router, id);
  }

  title(p: Purchase): string {
    return p.quantita > 1 ? `${p.articolo} × ${p.quantita}` : p.articolo;
  }

  private range(min: number, max: number): string {
    if (!min && !max) return '—';
    if (!max || max === min) return eur(min || max);
    return `${eur(min)} – ${max.toLocaleString('it-IT', { maximumFractionDigits: 2 })}`;
  }

  estimate(p: Purchase): string {
    return this.range(p.stima_min || 0, p.stima_max || 0);
  }

  undecided(): string {
    const t = this.totals();
    return this.range(t.undecidedMin, t.undecidedMax).replace(/^—$/, '€ 0');
  }

  listPrice(p: Purchase): string {
    if (p.prezzo_effettivo) return eur(p.prezzo_effettivo);
    return this.estimate(p);
  }

  listSub(p: Purchase): string {
    const area = p.expand?.area?.nome;
    switch (p.stato) {
      case 'ordinato': return p.data_acquisto ? `Ordinato il ${shortDay(toDay(p.data_acquisto))}` : 'Ordinato';
      case 'arrivato': return 'Arrivato · da montare';
      case 'montato': return 'Montato';
      case 'approvato': return ['Approvato', p.expand?.idea ? "dall'idea " + p.expand.idea.titolo : area].filter(Boolean).join(' · ');
      default: return area ?? '';
    }
  }

  chipText(p: Purchase): string {
    if (p.stato === 'ordinato' && p.data_acquisto) return `Ordinato il ${shortDay(toDay(p.data_acquisto))}`;
    return labelOf(PURCHASE_STATUSES, p.stato);
  }

  chipTone(p: Purchase): string {
    return p.stato === 'da_proporre' ? 'mute' : p.stato === 'approvato' ? 'warn' : 'ok';
  }

  vsEstimate(p: Purchase): string {
    const max = p.stima_max || p.stima_min || 0;
    const min = p.stima_min || 0;
    if (!max || !p.prezzo_effettivo) return '';
    if (p.prezzo_effettivo > max) return 'sopra la stima';
    return p.prezzo_effettivo < min ? 'sotto la stima' : 'nella stima';
  }

  next(p: Purchase) {
    return NEXT[p.stato] ?? null;
  }

  // --- actions ------------------------------------------------------------------------------
  private replace(updated: Purchase): void {
    this.purchases.update((list) => list.map((x) => (x.id === updated.id ? updated : x)));
  }

  async advance(p: Purchase, to: PurchaseStatus): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const data: Partial<Purchase> = { stato: to };
      if (this.paid && !p.prezzo_effettivo) data.prezzo_effettivo = Number(this.paid);
      const updated = await this.purchasesService.update(p.id, data);
      this.replace(updated);
      this.paid = null;
      if (to === 'montato') await this.offerToCompleteIdea(updated);
    } catch {
      this.error.set('Impossibile cambiare lo stato.');
    } finally {
      this.busy.set(false);
    }
  }

  /** When every purchase of an idea is mounted, offer to mark the idea as done. */
  private async offerToCompleteIdea(p: Purchase): Promise<void> {
    if (!p.idea) return;
    const siblings = this.purchases().filter((x) => x.idea === p.idea);
    const idea = this.ideas().find((i) => i.id === p.idea);
    if (!idea || idea.stato === 'fatta' || !siblings.every((x) => x.stato === 'montato')) return;
    if (confirm(`Tutti gli acquisti di "${idea.titolo}" sono montati. Segnare l'idea come fatta?`)) {
      const updated = await this.ideasService.update(idea.id, { stato: 'fatta' });
      this.ideas.update((list) => list.map((i) => (i.id === updated.id ? updated : i)));
    }
  }

  async remove(p: Purchase): Promise<void> {
    if (this.busy() || !confirm(`Annullare l'acquisto «${p.articolo}»? Verrà eliminato.`)) return;
    this.busy.set(true);
    try {
      await this.purchasesService.remove(p.id);
      this.purchases.update((list) => list.filter((x) => x.id !== p.id));
      this.select(null);
    } finally {
      this.busy.set(false);
    }
  }

  // --- create and edit ----------------------------------------------------------------------
  private emptyDraft(): Draft {
    return { articolo: '', quantita: 1, area: '', fornitore: '', link: '', stimaMin: null, stimaMax: null, prezzo: null, stato: 'da_proporre', idea: '' };
  }

  startNew(): void {
    this.draft = this.emptyDraft();
    this.error.set('');
    this.select(NEW_ID);
  }

  startEdit(p: Purchase): void {
    this.draft = {
      articolo: p.articolo,
      quantita: p.quantita || 1,
      area: p.area ?? '',
      fornitore: p.fornitore ?? '',
      link: p.link ?? '',
      stimaMin: p.stima_min || null,
      stimaMax: p.stima_max || null,
      prezzo: p.prezzo_effettivo || null,
      stato: p.stato,
      idea: p.idea ?? '',
    };
    this.error.set('');
    this.editing.set(true);
  }

  private payload(): Partial<Purchase> {
    const d = this.draft;
    return {
      articolo: d.articolo.trim(),
      quantita: Number(d.quantita) || 1,
      area: d.area,
      fornitore: d.fornitore.trim(),
      link: d.link.trim(),
      stima_min: Number(d.stimaMin) || 0,
      stima_max: Number(d.stimaMax) || 0,
      prezzo_effettivo: Number(d.prezzo) || 0,
      stato: d.stato,
      idea: d.idea,
    };
  }

  async create(): Promise<void> {
    if (this.busy() || !this.draft.articolo.trim()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const created = await this.purchasesService.create(this.payload());
      this.purchases.update((list) => [created, ...list]);
      this.tab.set(created.stato === 'montato' ? 'montati' : 'incorso');
      this.select(created.id);
    } catch {
      this.error.set("Impossibile creare l'acquisto (controlla che il link sia un URL valido).");
    } finally {
      this.busy.set(false);
    }
  }

  async saveEdit(p: Purchase): Promise<void> {
    if (this.busy() || !this.draft.articolo.trim()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const updated = await this.purchasesService.update(p.id, this.payload());
      this.replace(updated);
      this.editing.set(false);
      if (updated.stato === 'montato' && p.stato !== 'montato') await this.offerToCompleteIdea(updated);
    } catch {
      this.error.set("Impossibile salvare l'acquisto (controlla che il link sia un URL valido).");
    } finally {
      this.busy.set(false);
    }
  }
}
