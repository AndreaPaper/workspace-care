import { Component, DestroyRef, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MasterDetail } from '../../core/ui/master-detail';
import { PageHead } from '../../core/ui/page-head';
import { PocketBaseService } from '../../core/pocketbase.service';
import { NEW_ID, pinFirstSelection, selectedIdFromUrl, selectItem } from '../../core/ui/selection';
import { StepsBar } from '../../core/ui/steps-bar';
import { watchPageParams } from '../../core/page-params';
import {
  Area, IDEA_CATEGORIES, IDEA_PRIORITIES, IDEA_STATUSES, Idea, IdeaCategory, IdeaLink, IdeaPriority, IdeaStatus, PURCHASE_STATUSES,
  Purchase, labelOf,
} from '../../models/models';
import { AreasService } from '../../services/areas.service';
import { IdeaLinksService } from '../../services/idea-links.service';
import { IdeasService } from '../../services/ideas.service';
import { PurchasesService } from '../../services/purchases.service';

type Tab = 'valutare' | 'incorso' | 'chiuse';
type Urgency = IdeaPriority | 'nessuna';

const TAB_STATES: Record<Tab, IdeaStatus[]> = {
  valutare: ['idea', 'da_valutare'],
  incorso: ['proposta', 'approvata', 'in_corso'],
  chiuse: ['fatta', 'scartata'],
};
const GROUPS: { key: Urgency; label: string; tone: string }[] = [
  { key: 'alta', label: 'ALTA', tone: 'alta' },
  { key: 'media', label: 'MEDIA', tone: 'media' },
  { key: 'bassa', label: 'BASSA', tone: '' },
  { key: 'nessuna', label: 'SENZA URGENZA', tone: '' },
];
/** The button that takes an idea to its next state. */
const NEXT: Partial<Record<IdeaStatus, { to: IdeaStatus; label: string }>> = {
  idea: { to: 'da_valutare', label: 'Metti da valutare' },
  da_valutare: { to: 'proposta', label: 'Proponi alla direzione' },
  proposta: { to: 'approvata', label: 'Segna come approvata' },
  in_corso: { to: 'fatta', label: 'Segna come fatta' },
};
const STEPS = IDEA_STATUSES.filter((s) => s.value !== 'scartata');
const LIST_CAP = 25;
const eur = (n: number) => '€ ' + n.toLocaleString('it-IT', { maximumFractionDigits: 2 });

interface Draft {
  titolo: string;
  area: string;
  categoria: IdeaCategory | '';
  stato: IdeaStatus;
  priorita: IdeaPriority | '';
  costoMin: number | null;
  costoMax: number | null;
  descrizione: string;
  note: string;
  urls: string;
}

import { ConfirmService } from '../../services/confirm.service';

@Component({
  selector: 'app-ideas',
  imports: [FormsModule, RouterLink, MatIconModule, MasterDetail, PageHead, StepsBar],
  template: `
    <app-page-head title="Idee">
      <button type="button" class="btn btn-primary" (click)="startNew()"><mat-icon aria-hidden="true">add</mat-icon> Nuova idea</button>
    </app-page-head>

    <app-master-detail listLabel="Elenco idee" detailLabel="Dettaglio idea">
      <ng-container list>
        <div role="tablist" aria-label="Filtra per stato" class="md-tabs">
          <button type="button" role="tab" class="md-tab" [attr.aria-selected]="tab() === 'valutare'" (click)="setTab('valutare')">Da valutare {{ count('valutare') }}</button>
          <button type="button" role="tab" class="md-tab" [attr.aria-selected]="tab() === 'incorso'" (click)="setTab('incorso')">In corso {{ count('incorso') }}</button>
          <button type="button" role="tab" class="md-tab" [attr.aria-selected]="tab() === 'chiuse'" (click)="setTab('chiuse')">Chiuse {{ count('chiuse') }}</button>
        </div>
        <label class="md-search">
          <mat-icon aria-hidden="true">search</mat-icon>
          <span class="sr-only">Cerca un'idea</span>
          <input type="search" placeholder="Cerca un'idea" [ngModel]="search()" (ngModelChange)="search.set($event)" />
        </label>
        <div role="group" aria-label="Filtra per urgenza" class="md-filters">
          <button type="button" class="md-filter" [attr.aria-pressed]="urgency() === 'alta'" (click)="toggleUrgency('alta')"><span class="dot alta"></span>Alta {{ urgencyCount('alta') }}</button>
          <button type="button" class="md-filter" [attr.aria-pressed]="urgency() === 'media'" (click)="toggleUrgency('media')"><span class="dot media"></span>Media {{ urgencyCount('media') }}</button>
          <button type="button" class="md-filter" [attr.aria-pressed]="urgency() === 'bassa'" (click)="toggleUrgency('bassa')"><span class="dot bassa"></span>Bassa {{ urgencyCount('bassa') }}</button>
          <button type="button" class="md-filter dashed" [attr.aria-pressed]="urgency() === 'nessuna'" (click)="toggleUrgency('nessuna')">Senza {{ urgencyCount('nessuna') }}</button>
        </div>

        @for (g of groups(); track g.key) {
          <span [class]="'md-label ' + g.tone">{{ g.label }}</span>
          @for (i of g.items; track i.id) {
            <a class="md-item" [class.sel]="i.id === current()?.id" role="button" tabindex="0" (click)="select(i.id)" (keydown.enter)="select(i.id)" [attr.aria-current]="i.id === current()?.id ? 'true' : null">
              <span class="md-thumb" [style.background-image]="cover(i)" aria-hidden="true"></span>
              <span class="grow"><strong class="t">{{ i.titolo }}</strong><span class="s">{{ listSub(i) }}</span></span>
            </a>
          }
        } @empty {
          <p class="md-empty">{{ search() ? 'Nessuna idea trovata.' : 'Nessuna idea in questa vista.' }}</p>
        }
        @if (hiddenCount() > 0) {
          <button type="button" class="md-more" (click)="showAll.set(true)">Mostra tutte le {{ total() }}</button>
        }
      </ng-container>

      <ng-container detail>
        @if (isNew()) {
          <div class="md-head"><div><h2 class="md-title">Nuova idea</h2></div></div>
          <div class="md-form">
            <label class="md-field wide"><span>Titolo</span><input type="text" name="titolo" [(ngModel)]="draft.titolo" required /></label>
            <label class="md-field">
              <span>Area</span>
              <select name="area" [(ngModel)]="draft.area">
                <option value="">(nessuna)</option>
                @for (a of areas(); track a.id) { <option [value]="a.id">{{ a.nome }}</option> }
              </select>
            </label>
            <div class="md-field">
              <span>Urgenza</span>
              <div class="md-seg" role="radiogroup" aria-label="Urgenza">
                @for (p of priorities; track p.value) {
                  <button type="button" role="radio" [class]="p.value" [attr.aria-checked]="draft.priorita === p.value" (click)="draft.priorita = draft.priorita === p.value ? '' : p.value">{{ p.label }}</button>
                }
              </div>
            </div>
            <label class="md-field wide"><span>Link (uno per riga, opzionale)</span><textarea name="urls" rows="3" placeholder="https://…" [(ngModel)]="draft.urls"></textarea></label>
          </div>
          @if (error()) { <p class="md-error" role="alert">{{ error() }}</p> }
          <div class="md-actions flush">
            <button type="button" class="btn btn-primary" [disabled]="!draft.titolo.trim() || busy()" (click)="create()">Crea idea</button>
            <button type="button" class="btn btn-ghost" (click)="select(null)">Annulla</button>
          </div>
        } @else if (current(); as i) {
          <div class="md-head">
            <div>
              <span class="chips">
                @if (i.expand?.area?.nome) { <span class="md-chip mute">{{ i.expand?.area?.nome }}</span> }
                @if (i.categoria) { <span class="md-chip mute">{{ labelOf(categories, i.categoria) }}</span> }
                @if (i.stato === 'scartata') { <span class="md-chip bad">Scartata</span> }
              </span>
              <h2 class="md-title">{{ i.titolo }}</h2>
            </div>
            <button type="button" class="icon-btn" aria-label="Modifica idea" (click)="startEdit(i)"><mat-icon aria-hidden="true">edit</mat-icon></button>
          </div>

          @if (editing()) {
            <div class="md-form">
              <label class="md-field wide"><span>Titolo</span><input type="text" name="titolo" [(ngModel)]="draft.titolo" required /></label>
              <label class="md-field">
                <span>Area</span>
                <select name="area" [(ngModel)]="draft.area">
                  <option value="">(nessuna)</option>
                  @for (a of areas(); track a.id) { <option [value]="a.id">{{ a.nome }}</option> }
                </select>
              </label>
              <label class="md-field">
                <span>Categoria</span>
                <select name="categoria" [(ngModel)]="draft.categoria">
                  <option value="">(nessuna)</option>
                  @for (c of categories; track c.value) { <option [value]="c.value">{{ c.label }}</option> }
                </select>
              </label>
              <label class="md-field">
                <span>Stato</span>
                <select name="stato" [(ngModel)]="draft.stato">
                  @for (s of statuses; track s.value) { <option [value]="s.value">{{ s.label }}</option> }
                </select>
              </label>
              <label class="md-field">
                <span>Urgenza</span>
                <select name="priorita" [(ngModel)]="draft.priorita">
                  <option value="">(nessuna)</option>
                  @for (p of priorities; track p.value) { <option [value]="p.value">{{ p.label }}</option> }
                </select>
              </label>
              <label class="md-field"><span>Costo minimo (€)</span><input type="number" min="0" name="costoMin" [(ngModel)]="draft.costoMin" /></label>
              <label class="md-field"><span>Costo massimo (€)</span><input type="number" min="0" name="costoMax" [(ngModel)]="draft.costoMax" /></label>
              <label class="md-field wide"><span>Descrizione</span><textarea name="descrizione" rows="4" [(ngModel)]="draft.descrizione"></textarea></label>
              <label class="md-field wide"><span>Note</span><textarea name="note" rows="3" [(ngModel)]="draft.note"></textarea></label>
            </div>
            @if (error()) { <p class="md-error" role="alert">{{ error() }}</p> }
            <div class="md-actions flush">
              <button type="button" class="btn btn-primary" [disabled]="!draft.titolo.trim() || busy()" (click)="saveEdit(i)">Salva</button>
              <button type="button" class="btn btn-outline" (click)="editing.set(false)">Annulla</button>
              <button type="button" class="btn btn-ghost btn-danger-text push" (click)="remove(i)">Elimina idea</button>
            </div>
          } @else {
            <div class="meta">
              <div class="md-field">
                <span>URGENZA</span>
                <div class="md-seg" role="radiogroup" aria-label="Urgenza">
                  @for (p of priorities; track p.value) {
                    <button type="button" role="radio" [class]="p.value" [attr.aria-checked]="i.priorita === p.value" (click)="setPriority(i, i.priorita === p.value ? '' : p.value)">{{ p.label }}</button>
                  }
                </div>
              </div>
              <div class="md-field"><span>COSTO STIMATO</span><strong class="cost">{{ cost(i) }}</strong></div>
            </div>

            @if (i.stato !== 'scartata') { <app-steps-bar [steps]="steps" [current]="i.stato" label="Stato: scegli una fase per cambiarlo" [selectable]="true" (choose)="setStatus(i, $event)" /> }

            @if (i.descrizione) { <p class="md-text">{{ i.descrizione }}</p> }
            @if (i.note) { <div class="note"><strong>Note</strong><p class="md-text">{{ i.note }}</p></div> }

            <div>
              <h3 class="md-h3">Link salvati · {{ links().length }}</h3>
              <div class="links">
                @for (l of links(); track l.id) {
                  <div class="link">
                    @if (l.immagine) { <img [src]="linkImage(l)" [alt]="l.titolo" /> } @else { <span class="noimg" aria-hidden="true"></span> }
                    <div class="info">
                      <a [href]="l.url" target="_blank" rel="noopener"><strong>{{ l.titolo || l.url }}</strong></a>
                      <span class="s">{{ linkMeta(l) }}</span>
                      @if (l.stato_anteprima && l.stato_anteprima !== 'ok') {
                        <span [class]="'md-chip small ' + (l.stato_anteprima === 'fallita' ? 'bad' : 'warn')">anteprima {{ l.stato_anteprima }}</span>
                        <button type="button" class="md-more" [disabled]="retrying() === l.id" (click)="retryPreview(l)">{{ retrying() === l.id ? 'Riprovo…' : 'Riprova anteprima' }}</button>
                        <div class="fallback">
                          <input type="url" placeholder="URL immagine" [attr.aria-label]="'URL immagine per ' + (l.titolo || l.url)" [(ngModel)]="imageUrls[l.id]" />
                          <button type="button" class="icon-mini" aria-label="Usa questo URL" (click)="setImageUrl(l)"><mat-icon aria-hidden="true">check</mat-icon></button>
                          <label class="upload"><mat-icon aria-hidden="true">upload</mat-icon> Screenshot<input type="file" accept="image/*" hidden (change)="uploadImage(l, $event)" /></label>
                        </div>
                      }
                      <button type="button" class="md-more" (click)="removeLink(l)">Rimuovi</button>
                    </div>
                  </div>
                }
                <form class="link add" (ngSubmit)="addLink(i)">
                  <label class="md-field"><span>+ Incolla un link</span><input type="url" name="url" placeholder="https://…" [(ngModel)]="newUrl" /></label>
                  <button type="submit" class="btn btn-soft" [disabled]="addingLink()">Aggiungi</button>
                </form>
              </div>
            </div>

            <div>
              <h3 class="md-h3">Foto</h3>
              <div class="photos">
                @for (f of i.foto; track f) {
                  <div class="photo"><img [src]="photoUrl(i, f)" alt="" /><button type="button" class="photo-x" aria-label="Rimuovi foto" (click)="removePhoto(i, f)"><mat-icon aria-hidden="true">close</mat-icon></button></div>
                }
                <label class="upload"><mat-icon aria-hidden="true">upload</mat-icon> Aggiungi foto<input type="file" accept="image/*" multiple hidden (change)="addPhotos(i, $event)" /></label>
              </div>
            </div>

            @if (purchases().length) {
              <a class="md-link-card" [routerLink]="['/acquisti']" [queryParams]="{ id: purchases()[0].id }">
                <mat-icon aria-hidden="true">shopping_cart</mat-icon>
                <span class="grow"><span>Acquisto collegato</span><strong>{{ purchases()[0].articolo }} · {{ purchaseStatus(purchases()[0]) }}</strong></span>
                <mat-icon aria-hidden="true">chevron_right</mat-icon>
              </a>
            }

            @if (error()) { <p class="md-error" role="alert">{{ error() }}</p> }

            <div class="md-actions">
              @if (next(i); as n) {
                <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="advance(i, n.to)">{{ n.label }}</button>
              }
              @if (i.stato === 'approvata') {
                @if (!purchases().length) {
                  <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="convert(i)"><mat-icon aria-hidden="true">shopping_cart</mat-icon> Converti in acquisto</button>
                }
                <button type="button" class="btn btn-outline" [disabled]="busy()" (click)="advance(i, 'fatta')">Segna come fatta</button>
              }
              @if (i.stato === 'fatta' || i.stato === 'scartata') {
                <button type="button" class="btn btn-outline" [disabled]="busy()" (click)="advance(i, 'idea')">Riapri</button>
              }
              @if (i.stato !== 'fatta' && i.stato !== 'scartata') {
                <button type="button" class="btn btn-ghost push" [disabled]="busy()" (click)="advance(i, 'scartata')">Scarta</button>
              }
            </div>
          }
        } @else {
          <p class="md-empty">Nessuna idea selezionata.</p>
        }
      </ng-container>
    </app-master-detail>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 20px; }
    a { color: #245a41; font-weight: 600; text-decoration: none; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chips:empty { display: none; }
    .md-item .md-thumb { background-size: cover; }
    .meta { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-end; }
    .meta .md-field > span { font-size: 11px; letter-spacing: .05em; color: #55584f; }
    .cost { font-size: 18px; }
    .note { padding: 12px 14px; border-radius: 14px; background: #f6f2ea; }
    .note strong { font-size: 12px; color: #45473f; }
    .links { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
    .link { border-radius: 16px; overflow: hidden; border: 1px solid #e6e0d3; display: flex; flex-direction: column; }
    .link .noimg { width: 100%; height: 110px; background: repeating-linear-gradient(135deg, #ece7dc 0 10px, #f3efe7 10px 20px); display: block; }
    /* The whole picture is shown (a screenshot must not be cropped), on a neutral background. */
    .link img { width: 100%; height: auto; max-height: 240px; object-fit: contain; background: #f6f2ea; display: block; }
    .link .info { padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; align-items: flex-start; min-width: 0; }
    .link .info strong { font-size: 13px; font-weight: 600; color: #22241f; overflow-wrap: anywhere; }
    .link .s { font-size: 12px; color: #55584f; }
    .link.add { border-style: dashed; border-color: #c9c3b6; padding: 12px; gap: 8px; justify-content: center; }
    .fallback { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
    .fallback input { flex: 1 1 100px; min-width: 0; height: 32px; padding: 0 8px; border: 1px solid #c9c3b6; border-radius: 10px; font: 12px Inter, system-ui, sans-serif; }
    .icon-mini { width: 32px; height: 32px; border: 1px solid #ddd7cb; border-radius: 999px; background: #fff; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
    .icon-mini mat-icon { width: 18px; height: 18px; font-size: 18px; }
    .upload { cursor: pointer; color: #245a41; display: inline-flex; gap: 4px; align-items: center; font-size: 13px; font-weight: 600; }
    .upload mat-icon { width: 18px; height: 18px; font-size: 18px; }
    .photos { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
    .photo { position: relative; }
    .photo img { height: 96px; border-radius: 12px; display: block; }
    .photo-x { position: absolute; top: 4px; right: 4px; width: 26px; height: 26px; border: 0; border-radius: 999px; background: rgb(0 0 0 / .6); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .photo-x mat-icon { width: 16px; height: 16px; font-size: 16px; }
    .md-link-card { color: #22241f; font-weight: 400; }
    .md-link-card mat-icon { color: #45473f; }
  `,
})
export class Ideas implements OnInit {
  private readonly confirmService = inject(ConfirmService);
  private readonly ideasService = inject(IdeasService);
  private readonly areasService = inject(AreasService);
  private readonly linksService = inject(IdeaLinksService);
  private readonly purchasesService = inject(PurchasesService);
  private readonly pb = inject(PocketBaseService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly categories = IDEA_CATEGORIES;
  readonly statuses = IDEA_STATUSES;
  readonly priorities = IDEA_PRIORITIES;
  readonly steps = STEPS;
  readonly labelOf = labelOf;

  readonly ideas = signal<Idea[]>([]);
  readonly areas = signal<Area[]>([]);
  readonly links = signal<IdeaLink[]>([]);
  readonly purchases = signal<Purchase[]>([]);
  private readonly covers = signal<Record<string, string>>({});
  readonly tab = signal<Tab>('valutare');
  readonly search = signal('');
  readonly urgency = signal<Urgency | null>(null);
  readonly showAll = signal(false);
  readonly editing = signal(false);
  readonly busy = signal(false);
  readonly addingLink = signal(false);
  readonly error = signal('');
  /** Set before selecting a new idea so that a message about failed links survives the selection change. */
  private keepError = false;
  newUrl = '';
  imageUrls: Record<string, string> = {};
  draft: Draft = this.emptyDraft();

  private readonly selectedId = selectedIdFromUrl(this.route);
  readonly isNew = computed(() => this.selectedId() === NEW_ID);

  private inTab(i: Idea, tab: Tab): boolean {
    return TAB_STATES[tab].includes(i.stato);
  }

  private urgencyOf(i: Idea): Urgency {
    return i.priorita || 'nessuna';
  }

  /** Ideas of the current tab matching the search text (before the urgency filter). */
  private readonly inCurrentTab = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.ideas().filter((i) => this.inTab(i, this.tab()) && (!q || (i.titolo + ' ' + (i.descrizione ?? '')).toLowerCase().includes(q)));
  });

  private readonly filtered = computed(() => {
    const u = this.urgency();
    return u ? this.inCurrentTab().filter((i) => this.urgencyOf(i) === u) : this.inCurrentTab();
  });

  readonly total = computed(() => this.filtered().length);
  readonly hiddenCount = computed(() => (this.showAll() ? 0 : Math.max(0, this.total() - LIST_CAP)));

  readonly groups = computed(() => {
    let room = this.showAll() ? Infinity : LIST_CAP;
    return GROUPS.map((g) => {
      const items = this.filtered()
        .filter((i) => this.urgencyOf(i) === g.key)
        .sort((a, b) => String(a['created']).localeCompare(String(b['created'])))
        .slice(0, room);
      room -= items.length;
      return { ...g, items };
    }).filter((g) => g.items.length);
  });
  private readonly visible = computed(() => this.groups().flatMap((g) => g.items));

  readonly current = computed(() => {
    if (this.isNew()) return null;
    const id = this.selectedId();
    return this.ideas().find((i) => i.id === id) ?? this.visible()[0] ?? null;
  });

  constructor() {
    pinFirstSelection(this.router, this.selectedId, computed(() => this.visible()[0]?.id));
    // Links and purchases of the idea shown on the right.
    effect(() => {
      const id = this.current()?.id;
      untracked(() => {
        this.editing.set(false);
        if (this.keepError) this.keepError = false;
        else this.error.set('');
        this.newUrl = '';
        void this.loadRelated(id);
      });
    });
    // A link to an idea of another tab (dashboard, search, request) switches to that tab.
    effect(() => {
      const i = this.ideas().find((x) => x.id === this.selectedId());
      if (i) untracked(() => this.tab.set(this.tabOf(i)));
    });
  }

  async ngOnInit(): Promise<void> {
    const [ideas, areas] = await Promise.all([this.ideasService.list(), this.areasService.list()]);
    this.ideas.set(ideas);
    this.areas.set(areas);
    await this.loadCovers();
    watchPageParams(this.route, this.router, this.destroyRef, {
      onNew: (area) => this.startNew(area),
      onSearch: (q) => {
        this.search.set(q);
        this.urgency.set(null);
      },
    });
  }

  private tabOf(i: Idea): Tab {
    return (Object.keys(TAB_STATES) as Tab[]).find((t) => this.inTab(i, t)) ?? 'valutare';
  }

  private async loadCovers(): Promise<void> {
    const links = await this.linksService.listAll();
    const covers: Record<string, string> = {};
    for (const l of links) if (l.immagine && !covers[l.idea]) covers[l.idea] = this.linksService.imageUrl(l);
    this.covers.set(covers);
  }

  private async loadRelated(id: string | undefined): Promise<void> {
    if (!id) {
      this.links.set([]);
      this.purchases.set([]);
      return;
    }
    const [links, purchases] = await Promise.all([this.linksService.listByIdea(id), this.purchasesService.byIdea(id)]);
    this.links.set(links);
    this.purchases.set(purchases);
  }

  // --- list ---------------------------------------------------------------------------------
  select(id: string | null): void {
    selectItem(this.router, id);
  }

  setTab(tab: Tab): void {
    this.tab.set(tab);
    this.showAll.set(false);
  }

  count(tab: Tab): number {
    return this.ideas().filter((i) => this.inTab(i, tab)).length;
  }

  urgencyCount(u: Urgency): number {
    return this.inCurrentTab().filter((i) => this.urgencyOf(i) === u).length;
  }

  toggleUrgency(u: Urgency): void {
    this.urgency.update((cur) => (cur === u ? null : u));
    this.showAll.set(false);
  }

  cover(i: Idea): string {
    const url = this.ideasService.coverUrl(i, this.covers()[i.id]);
    return url ? `url("${url}")` : 'none';
  }

  cost(i: Idea): string {
    const min = i.costo_min || 0;
    const max = i.costo_max || 0;
    if (!min && !max) return '—';
    return !max || max === min ? eur(min || max) : `${eur(min)} – ${max.toLocaleString('it-IT', { maximumFractionDigits: 2 })}`;
  }

  listSub(i: Idea): string {
    return [i.expand?.area?.nome, this.cost(i) === '—' ? '' : this.cost(i)].filter(Boolean).join(' · ');
  }

  next(i: Idea) {
    return NEXT[i.stato] ?? null;
  }

  purchaseStatus(p: Purchase): string {
    return labelOf(PURCHASE_STATUSES, p.stato).toLowerCase();
  }

  // --- detail: images and links ---------------------------------------------------------------
  linkMeta(l: IdeaLink): string {
    return [l.sito, l.prezzo].filter(Boolean).join(' · ');
  }

  linkImage(l: IdeaLink): string {
    return this.linksService.imageFitUrl(l);
  }

  photoUrl(i: Idea, file: string): string {
    return this.pb.fileUrl(i, file, '300x200');
  }

  async addLink(i: Idea): Promise<void> {
    const url = this.newUrl.trim();
    if (this.addingLink() || !url) return;
    this.addingLink.set(true);
    this.error.set('');
    try {
      // The server fills in the preview while creating, so the returned link is already complete.
      const link = await this.linksService.create(i.id, url);
      this.links.update((l) => [...l, link]);
      this.newUrl = '';
      await this.loadCovers();
    } catch {
      this.error.set('Link non valido o non salvato (deve iniziare con http:// o https://).');
    } finally {
      this.addingLink.set(false);
    }
  }

  async removeLink(l: IdeaLink): Promise<void> {
    await this.linksService.remove(l.id);
    this.links.update((list) => list.filter((x) => x.id !== l.id));
    await this.loadCovers();
  }

  /** Id of the link whose preview is being fetched again. */
  readonly retrying = signal('');

  /** Fetches the page of the link again (the server keeps a picture that is already there). */
  async retryPreview(l: IdeaLink): Promise<void> {
    if (this.retrying()) return;
    this.retrying.set(l.id);
    this.error.set('');
    try {
      const updated = await this.linksService.retryPreview(l.id);
      this.links.update((list) => list.map((x) => (x.id === l.id ? updated : x)));
      await this.loadCovers();
    } catch {
      this.error.set('Impossibile ricaricare l\'anteprima.');
    } finally {
      this.retrying.set('');
    }
  }

  async setImageUrl(l: IdeaLink): Promise<void> {
    const url = (this.imageUrls[l.id] ?? '').trim();
    if (!url) return;
    // The server downloads the image when immagine_url changes.
    const updated = await this.linksService.update(l.id, { immagine_url: url });
    this.links.update((list) => list.map((x) => (x.id === l.id ? updated : x)));
    await this.loadCovers();
  }

  async uploadImage(l: IdeaLink, event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('immagine', file);
    form.append('stato_anteprima', 'parziale');
    const updated = await this.linksService.update(l.id, form);
    this.links.update((list) => list.map((x) => (x.id === l.id ? updated : x)));
    await this.loadCovers();
  }

  async addPhotos(i: Idea, event: Event): Promise<void> {
    const files = (event.target as HTMLInputElement).files;
    if (!files?.length) return;
    const form = new FormData();
    for (const f of Array.from(files)) form.append('foto+', f);
    this.replace(await this.ideasService.update(i.id, form));
  }

  async removePhoto(i: Idea, file: string): Promise<void> {
    this.replace(await this.ideasService.update(i.id, { 'foto-': file } as unknown as Partial<Idea>));
  }

  // --- actions ------------------------------------------------------------------------------
  private replace(updated: Idea): void {
    this.ideas.update((list) => list.map((x) => (x.id === updated.id ? updated : x)));
  }

  /** Picks a phase on the steps bar: changes the state without opening the edit form. */
  async setStatus(i: Idea, value: string): Promise<void> {
    if (value === i.stato) return;
    await this.advance(i, value as IdeaStatus);
  }

  async advance(i: Idea, to: IdeaStatus): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      this.replace(await this.ideasService.update(i.id, { stato: to }));
    } catch {
      this.error.set('Impossibile cambiare lo stato.');
    } finally {
      this.busy.set(false);
    }
  }

  async setPriority(i: Idea, priority: IdeaPriority | ''): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      this.replace(await this.ideasService.update(i.id, { priorita: priority }));
    } finally {
      this.busy.set(false);
    }
  }

  /** Creates the purchase on the server; with several links the user picks the one to copy. */
  async convert(i: Idea): Promise<void> {
    if (this.busy()) return;
    let linkId: string | undefined;
    if (this.links().length > 1) {
      linkId =
        (await this.confirmService.choose({
          title: "Quale link usare per l'acquisto?",
          text: "Fornitore e indirizzo dell'acquisto vengono copiati da questo link.",
          confirmLabel: "Crea l'acquisto",
          choices: this.links().map((l) => ({
            id: l.id,
            title: l.titolo || l.url,
            meta: [l.sito, l.prezzo].filter(Boolean).join(' · '),
            image: l.immagine ? this.linksService.imageUrl(l) : l.immagine_url || undefined,
          })),
        })) ?? undefined;
      if (!linkId) return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const res = await this.purchasesService.convert(i.id, linkId);
      this.purchases.set([res.acquisto]);
      this.replace({ ...i, stato: res.idea.stato } as Idea);
    } catch {
      this.error.set('Conversione non riuscita.');
    } finally {
      this.busy.set(false);
    }
  }

  async remove(i: Idea): Promise<void> {
    if (this.busy()) return;
    const nLinks = this.links().length;
    const list = nLinks ? [`${nLinks} ${nLinks === 1 ? 'link' : 'link'} con le anteprime`] : undefined;
    if (!(await this.confirmService.ask({ title: `Eliminare l'idea «${i.titolo}»?`, list, confirmLabel: 'Elimina idea' }))) return;
    this.busy.set(true);
    try {
      await this.ideasService.remove(i.id);
      this.ideas.update((list) => list.filter((x) => x.id !== i.id));
      this.select(null);
    } finally {
      this.busy.set(false);
    }
  }

  // --- create and edit ----------------------------------------------------------------------
  private emptyDraft(): Draft {
    return { titolo: '', area: '', categoria: '', stato: 'idea', priorita: '', costoMin: null, costoMax: null, descrizione: '', note: '', urls: '' };
  }

  startNew(area = ''): void {
    this.draft = { ...this.emptyDraft(), area };
    this.error.set('');
    this.select(NEW_ID);
  }

  startEdit(i: Idea): void {
    this.draft = {
      titolo: i.titolo,
      area: i.area ?? '',
      categoria: i.categoria ?? '',
      stato: i.stato,
      priorita: i.priorita ?? '',
      costoMin: i.costo_min || null,
      costoMax: i.costo_max || null,
      descrizione: i.descrizione ?? '',
      note: i.note ?? '',
      urls: '',
    };
    this.error.set('');
    this.editing.set(true);
  }

  async create(): Promise<void> {
    if (this.busy() || !this.draft.titolo.trim()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const idea = await this.ideasService.create({
        titolo: this.draft.titolo.trim(),
        area: this.draft.area,
        priorita: this.draft.priorita,
        stato: 'idea',
      });
      const urls = this.draft.urls.split('\n').map((u) => u.trim()).filter(Boolean);
      let failed = 0;
      // Sequential on purpose: each create triggers the preview download on the server.
      for (const url of urls) {
        try {
          await this.linksService.create(idea.id, url);
        } catch {
          failed++;
        }
      }
      this.ideas.update((list) => [idea, ...list]);
      if (urls.length) await this.loadCovers();
      this.setTab('valutare');
      if (failed) {
        this.error.set(`${failed} link non aggiunti: aggiungili da qui sotto (devono iniziare con http:// o https://).`);
        this.keepError = true;
      }
      this.select(idea.id);
    } catch {
      this.error.set("Impossibile creare l'idea.");
    } finally {
      this.busy.set(false);
    }
  }

  async saveEdit(i: Idea): Promise<void> {
    if (this.busy() || !this.draft.titolo.trim()) return;
    this.busy.set(true);
    this.error.set('');
    const d = this.draft;
    try {
      this.replace(
        await this.ideasService.update(i.id, {
          titolo: d.titolo.trim(),
          area: d.area,
          categoria: d.categoria,
          stato: d.stato,
          priorita: d.priorita,
          costo_min: Number(d.costoMin) || 0,
          costo_max: Number(d.costoMax) || 0,
          descrizione: d.descrizione,
          note: d.note,
        }),
      );
      this.editing.set(false);
    } catch {
      this.error.set('Impossibile salvare: controlla i valori inseriti.');
    } finally {
      this.busy.set(false);
    }
  }
}
