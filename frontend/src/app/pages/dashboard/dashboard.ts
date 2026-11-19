import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { Check, Idea, IdeaPriority, Purchase, REQUEST_STATUSES, WorkRequest, labelOf } from '../../models/models';
import { ControlsService } from '../../services/controls.service';
import { diffDays, longDay, shortDay, todayDay, toDay, weekdayName } from '../../services/dates';
import { IdeasService } from '../../services/ideas.service';
import { PurchasesService } from '../../services/purchases.service';
import { BudgetService } from '../../services/budget.service';
import { SettingsService } from '../../services/settings.service';
import { RequestsService } from '../../services/requests.service';

type PriorityFilter = 'tutte' | IdeaPriority | 'nessuna';
type CheckTone = 'late' | 'today' | 'soon' | 'later';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const OPEN_REQUEST = ['ricevuta', 'in_valutazione', 'in_corso'];
/** With the "Tutte" filter the list shows this many ideas before "Mostra le altre". */
const COLLAPSED_IDEAS = 5;
const FREQUENCY: Record<string, string> = {
  settimanale: 'Ogni settimana',
  bisettimanale: 'Ogni 2 settimane',
  mensile: 'Ogni mese',
  trimestrale: 'Ogni 3 mesi',
};

@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe, RouterLink, MatIconModule],
  template: `
    <header class="head">
      <div class="title">
        <span class="date">{{ dateLine }}</span>
        <h1>{{ greeting }}{{ name() ? ' ' + name() : '' }}</h1>
        <span class="summary">{{ summary() }}</span>
      </div>
      <div class="quick">
        <a class="pill soft" routerLink="/idee" [queryParams]="{ nuova: 1 }"><mat-icon aria-hidden="true">lightbulb</mat-icon> Idea</a>
        <a class="pill soft" routerLink="/richieste" [queryParams]="{ nuova: 1 }"><mat-icon aria-hidden="true">inbox</mat-icon> Richiesta</a>
        <a class="pill outline" routerLink="/riepilogo"><mat-icon aria-hidden="true">description</mat-icon> Riepilogo PDF</a>
      </div>
    </header>

    @if (late()[0]; as worst) {
      <div class="alert" role="alert">
        <span class="alert-ico"><mat-icon aria-hidden="true">warning</mat-icon></span>
        <div class="alert-txt">
          <strong>{{ worst.nome }} in ritardo di {{ lateDays(worst) }}</strong>
          <span>
            Era previsto per {{ longDay(toDay(worst.prossima_scadenza)) }}.
            @if (late().length > 1) { Altri {{ late().length - 1 }} in ritardo. }
          </span>
        </div>
        <button type="button" class="alert-btn" (click)="done(worst)"><mat-icon aria-hidden="true">check</mat-icon> Fatto adesso</button>
      </div>
    }

    <section aria-labelledby="t-controlli" class="block">
      <div class="block-head">
        <h2 id="t-controlli">Controlli</h2>
        <a routerLink="/controlli">Storico e impostazioni</a>
      </div>
      @if (checks().length) {
        <div class="checks">
          @for (c of checks(); track c.id) {
            <div class="check" [class.late]="tone(c) === 'late'" [class.today]="tone(c) === 'today'">
              <span [class]="'tag ' + tone(c)">{{ dueLabel(c) }}</span>
              <strong>{{ c.nome }}</strong>
              <span class="sub">{{ checkSub(c) }}</span>
              <button type="button" class="act" [class.primary]="tone(c) === 'late' || tone(c) === 'today'" (click)="done(c)">
                @if (tone(c) === 'late' || tone(c) === 'today') { <mat-icon aria-hidden="true">check</mat-icon> Fatto } @else { Fatto in anticipo }
              </button>
            </div>
          }
        </div>
      } @else {
        <p class="empty">Nessun controllo configurato. <a routerLink="/controlli" [queryParams]="{ nuova: 1 }">Crea il primo</a>.</p>
      }
    </section>

    <div class="cols">
      <section aria-labelledby="t-idee" class="card main-card">
        <div class="block-head">
          <h2 id="t-idee">Idee da valutare <span class="count">· {{ toEvaluate().length }}</span></h2>
          <a routerLink="/idee">Tutte le idee</a>
        </div>

        @if (toEvaluate().length) {
          <div role="group" aria-label="Filtra per urgenza" class="filters">
            <button type="button" class="chip-btn" [class.on]="filter() === 'tutte'" [attr.aria-pressed]="filter() === 'tutte'" (click)="setFilter('tutte')">Tutte {{ toEvaluate().length }}</button>
            <button type="button" class="chip-btn" [class.on]="filter() === 'alta'" [attr.aria-pressed]="filter() === 'alta'" (click)="setFilter('alta')"><span class="dot alta"></span>Alta {{ byPriority().alta.length }}</button>
            <button type="button" class="chip-btn" [class.on]="filter() === 'media'" [attr.aria-pressed]="filter() === 'media'" (click)="setFilter('media')"><span class="dot media"></span>Media {{ byPriority().media.length }}</button>
            <button type="button" class="chip-btn" [class.on]="filter() === 'bassa'" [attr.aria-pressed]="filter() === 'bassa'" (click)="setFilter('bassa')"><span class="dot bassa"></span>Bassa {{ byPriority().bassa.length }}</button>
            <button type="button" class="chip-btn dashed" [class.on]="filter() === 'nessuna'" [attr.aria-pressed]="filter() === 'nessuna'" (click)="setFilter('nessuna')">Senza urgenza {{ unsorted().length }}</button>
          </div>

          @if ((filter() === 'tutte' || filter() === 'nessuna') && unsorted().length) {
            <div class="triage">
              <span class="eyebrow">DA SMISTARE · {{ unsorted().length }}</span>
              @for (i of triageRows(); track i.id) {
                <div class="triage-row">
                  <span class="grow"><strong>{{ i.titolo }}</strong><span class="sub">{{ areaOf(i) }}{{ areaOf(i) ? ' · ' : '' }}{{ addedLabel(i) }}</span></span>
                  <div role="group" class="seg" [attr.aria-label]="'Urgenza per ' + i.titolo">
                    <button type="button" class="alta" (click)="setPriority(i, 'alta')">Alta</button>
                    <button type="button" class="media" (click)="setPriority(i, 'media')">Media</button>
                    <button type="button" class="bassa" (click)="setPriority(i, 'bassa')">Bassa</button>
                  </div>
                </div>
              }
              @if (unsorted().length > triageRows().length) {
                <button type="button" class="link" (click)="showAllTriage.set(true)">Smista le altre {{ unsorted().length - triageRows().length }}</button>
              }
            </div>
          }

          @if (filter() !== 'nessuna') {
            @for (g of groups().groups; track g.key) {
              <span [class]="'eyebrow ' + g.key">{{ g.label }} · {{ byPriority()[g.key].length }}</span>
              @for (i of g.items; track i.id) {
                <a class="idea" routerLink="/idee" [queryParams]="{ id: i.id }">
                  <span [class]="'dot ' + g.key"></span>
                  <span class="grow"><strong>{{ i.titolo }}</strong><span class="sub">{{ areaOf(i) }}{{ areaOf(i) ? ' · ' : '' }}{{ sinceLabel(i) }}</span></span>
                </a>
              }
            }
            @if (groups().hidden > 0) {
              <button type="button" class="link" (click)="showAll.set(true)">Mostra le altre {{ groups().hidden }}</button>
            }
            @if (!groups().groups.length && !(filter() === 'tutte' && unsorted().length)) {
              <p class="empty">Nessuna idea con questa urgenza.</p>
            }
          }
        } @else {
          <p class="empty">Nessuna idea da valutare. <a routerLink="/idee" [queryParams]="{ nuova: 1 }">Aggiungine una</a>.</p>
        }
      </section>

      <div class="side">
        <section aria-labelledby="t-richieste" class="card">
          <div class="block-head">
            <h2 id="t-richieste">Richieste</h2>
            <a routerLink="/richieste">Tutte</a>
          </div>
          @for (r of requestRows(); track r.id) {
            <div class="request">
              <span class="avatar" aria-hidden="true">{{ initials(r) }}</span>
              <span class="grow"><strong>{{ r.titolo }}</strong><span class="sub">{{ r.richiedente || 'Senza nome' }} · {{ requestStatus(r) }} da {{ requestSince(r) }}</span></span>
              <button type="button" class="mini" (click)="closeRequest(r)"><mat-icon aria-hidden="true">check</mat-icon> Fatta</button>
            </div>
          } @empty {
            <p class="empty">Nessuna richiesta aperta.</p>
          }
          @if (openRequests().length > requestRows().length) {
            <a class="link" routerLink="/richieste">Altre {{ openRequests().length - requestRows().length }} richieste aperte</a>
          }
          @if (lastClosed(); as lc) {
            <span class="sub">L'ultima chiusa: «{{ lc.titolo }}», il {{ shortDay(toDay(lc['updated'])) }}.</span>
          }
        </section>

        <section aria-labelledby="t-acquisti" class="card">
          <h2 id="t-acquisti">Pronte per l'acquisto</h2>
          @for (i of ready(); track i.id) {
            <div class="buy">
              <span class="grow"><strong>{{ i.titolo }}</strong><span class="sub">Idea approvata{{ areaOf(i) ? ' · ' + areaOf(i) : '' }}</span></span>
              <button type="button" class="mini solid" (click)="createPurchase(i)">Crea acquisto</button>
            </div>
          } @empty {
            <p class="empty">Nessuna idea approvata in attesa di acquisto.</p>
          }
          @if (proposed() > 0) {
            <span class="sub">{{ proposed() === 1 ? '1 idea proposta alla direzione, in attesa' : proposed() + ' idee proposte alla direzione, in attesa' }} di risposta.</span>
          }
          @if (bv(); as b) {
            <div class="budget">
              <div class="budget-line">
                <strong>{{ b.spent | currency: 'EUR' : 'symbol' : '1.0-0' }}</strong>
                <span class="sub">spesi su {{ b.annual | currency: 'EUR' : 'symbol' : '1.0-0' }} di budget dell'anno</span>
              </div>
              <div class="bar" role="img" [attr.aria-label]="bvProgress() + '% del budget annuale già speso'"><div [style.width.%]="bvProgress()"></div></div>
              <span class="sub">
                @if (b.left < 0) { <strong class="over">{{ -b.left | currency: 'EUR' : 'symbol' : '1.0-0' }} oltre il budget</strong> } @else { {{ b.left | currency: 'EUR' : 'symbol' : '1.0-0' }} ancora disponibili }
                · {{ budget().toOrder }} da ordinare · <a routerLink="/acquisti">Tutti gli acquisti</a>
              </span>
            </div>
          } @else if (budget().estimateMax > 0 || budget().spent > 0) {
            <div class="budget">
              <div class="budget-line">
                <strong>{{ budget().spent | currency: 'EUR' : 'symbol' : '1.0-0' }}</strong>
                <span class="sub">spesi su {{ budget().spent + budget().remaining | currency: 'EUR' : 'symbol' : '1.0-0' }} previsti</span>
              </div>
              <div class="bar" role="img" [attr.aria-label]="progress() + '% del budget previsto già speso'"><div [style.width.%]="progress()"></div></div>
              <span class="sub">{{ budget().remaining | currency: 'EUR' : 'symbol' : '1.0-0' }} ancora da spendere · {{ budget().toOrder }} da ordinare · <a routerLink="/acquisti">Tutti gli acquisti</a></span>
            </div>
          }
        </section>
      </div>
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 22px; font-size: 14px; }
    h1 { margin: 0; font: 800 30px 'Plus Jakarta Sans', Inter, sans-serif; }
    h2 { margin: 0; font: 700 20px 'Plus Jakarta Sans', Inter, sans-serif; }
    #t-richieste, #t-acquisti { font-size: 18px; }
    a { color: #245a41; font-weight: 600; text-decoration: none; }
    a:hover { color: #173d2b; text-decoration: underline; }
    button { font-family: inherit; cursor: pointer; }
    button:focus-visible, a:focus-visible { outline: 3px solid #2f6fb5; outline-offset: 2px; }
    mat-icon { width: 18px; height: 18px; font-size: 18px; }
    .sub { font-size: 12px; color: #55584f; }
    .grow { flex: 1 1 150px; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .grow strong { font-weight: 600; font-size: 13px; }
    .empty { margin: 0; color: #55584f; font-size: 13px; }
    .head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; }
    .title { display: flex; flex-direction: column; gap: 6px; }
    .date { font-size: 13px; color: #55584f; }
    .summary { color: #55584f; }
    .quick { display: flex; flex-wrap: wrap; gap: 8px; }
    .pill { display: flex; align-items: center; gap: 6px; height: 44px; padding: 0 16px; border-radius: 999px; font-weight: 600; font-size: 14px; text-decoration: none; }
    .pill.soft { background: #e3eee7; color: #173d2b; }
    .pill.outline { border: 1px solid #b9b3a6; color: #22241f; }
    .pill:hover { text-decoration: none; filter: brightness(.97); }

    .alert { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; padding: 14px 18px; border-radius: 18px; background: #fce4e1; color: #7a1a12; }
    .alert-ico { width: 40px; height: 40px; flex: none; border-radius: 12px; background: #b42318; color: #fff; display: flex; align-items: center; justify-content: center; }
    .alert-ico mat-icon { width: 22px; height: 22px; font-size: 22px; }
    .alert-txt { flex: 1 1 260px; display: flex; flex-direction: column; gap: 2px; }
    .alert-txt strong { font-size: 15px; }
    .alert-txt span { font-size: 13px; }
    .alert-btn { display: flex; align-items: center; gap: 6px; height: 40px; padding: 0 16px; border: 0; border-radius: 999px; background: #b42318; color: #fff; font: 600 13px Inter, sans-serif; }

    .block { display: flex; flex-direction: column; gap: 12px; }
    .block-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 12px; }
    .block-head a { font-size: 13px; }
    .count { font-weight: 600; color: #55584f; }
    .checks { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
    .check { display: flex; flex-direction: column; gap: 10px; padding: 16px; border-radius: 20px; background: #fff; border: 2px solid transparent; }
    .check.late { border-color: #e8a39c; }
    .check.today { border-color: #ebcb8b; }
    .check strong { font-size: 15px; }
    .tag { align-self: flex-start; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
    .tag.late { background: #fce4e1; color: #9b1c12; }
    .tag.today { background: #fbebc8; color: #6e4700; }
    .tag.soon { background: #e3eee7; color: #245a41; }
    .tag.later { background: #efebe3; color: #45473f; }
    .act { margin-top: auto; display: flex; align-items: center; justify-content: center; gap: 6px; height: 40px; border: 1px solid #c9c3b6; border-radius: 12px; background: #fff; color: #22241f; font: 600 13px Inter, sans-serif; }
    .act.primary { border: 0; background: #2e6a4f; color: #fff; }
    .act:hover { filter: brightness(.96); }

    .cols { display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-start; }
    .card { box-sizing: border-box; padding: 20px 22px; border-radius: 24px; background: #fff; display: flex; flex-direction: column; gap: 10px; }
    .main-card { flex: 999 1 520px; min-width: 0; padding: 22px 24px; }
    .side { flex: 1 1 300px; min-width: 0; display: flex; flex-direction: column; gap: 20px; }
    .filters { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip-btn { display: flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; border: 1px solid #ddd7cb; border-radius: 999px; background: #fff; color: #22241f; font: 500 13px Inter, sans-serif; }
    .chip-btn.dashed { border: 1px dashed #a8a291; }
    .chip-btn.on { background: #22241f; border-color: #22241f; color: #fff; font-weight: 600; }
    .dot { width: 8px; height: 8px; flex: none; border-radius: 999px; background: #a8a291; }
    .dot.alta { background: #c2410c; }
    .dot.media { background: #d9921e; }
    .dot.bassa { background: #a8a291; }
    .eyebrow { margin-top: 8px; font-size: 11px; font-weight: 700; letter-spacing: .06em; color: #45473f; }
    .eyebrow.alta { color: #9a3412; }
    .eyebrow.media { color: #6e4700; }
    .triage { margin-top: 6px; padding: 14px 16px; border-radius: 18px; background: #f6f2ea; display: flex; flex-direction: column; gap: 4px; }
    .triage .eyebrow { margin-top: 0; }
    .triage-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #e6e0d3; }
    .seg { display: flex; border: 1px solid #c9c3b6; border-radius: 999px; overflow: hidden; }
    .seg button { height: 34px; padding: 0 12px; border: 0; background: #fff; font: 600 12px Inter, sans-serif; }
    .seg button + button { border-left: 1px solid #c9c3b6; }
    .seg .alta { color: #9a3412; }
    .seg .media { color: #6e4700; }
    .seg .bassa { color: #45473f; }
    .seg button:hover { background: #f6f2ea; }
    .idea { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #efebe3; color: #22241f; font-weight: 400; }
    .idea:hover { text-decoration: none; background: #fbf9f4; }
    .link { align-self: flex-start; border: 0; background: none; padding: 4px 0; color: #245a41; font: 600 12px Inter, sans-serif; text-decoration: none; }
    .link:hover { text-decoration: underline; }
    .request, .buy { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 12px; border-radius: 14px; background: #f6f2ea; }
    .buy { background: #edf5f0; }
    .avatar { width: 34px; height: 34px; border-radius: 999px; background: #dde7f7; color: #1f3f73; font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: center; }
    .mini { display: flex; align-items: center; gap: 4px; height: 36px; padding: 0 12px; border: 0; border-radius: 999px; background: #e3eee7; color: #173d2b; font: 600 12px Inter, sans-serif; }
    .mini.solid { background: #2e6a4f; color: #fff; }
    .budget { margin-top: 4px; padding-top: 12px; border-top: 1px solid #efebe3; display: flex; flex-direction: column; gap: 6px; }
    .over { color: #b42318; }
    .budget-line { display: flex; align-items: baseline; gap: 8px; }
    .budget-line strong { font-size: 20px; font-family: 'Plus Jakarta Sans', Inter, sans-serif; }
    .bar { height: 8px; border-radius: 4px; background: #efebe3; overflow: hidden; }
    .bar div { height: 100%; background: #2f6fb5; }
    @media (max-width: 800px) { h1 { font-size: 26px; } .card, .main-card { padding: 18px; } }
  `,
})
export class Dashboard implements OnInit {
  private readonly ideasService = inject(IdeasService);
  private readonly controlsService = inject(ControlsService);
  private readonly requestsService = inject(RequestsService);
  private readonly purchasesService = inject(PurchasesService);

  readonly toDay = toDay;
  readonly shortDay = shortDay;
  readonly longDay = longDay;

  private readonly today = todayDay();
  readonly dateLine = longDay(this.today).replace(/^./, (c) => c.toUpperCase());
  private readonly settingsService = inject(SettingsService);
  /** The name set in Impostazioni, for the greeting. */
  readonly name = computed(() => this.settingsService.settings()?.userName ?? '');
  readonly greeting = (() => {
    const h = new Date().getHours();
    return h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';
  })();

  private readonly ideas = signal<Idea[]>([]);
  readonly checks = signal<Check[]>([]);
  private readonly lastRun = signal<Record<string, string>>({});
  private readonly requests = signal<WorkRequest[]>([]);
  private readonly purchases = signal<Purchase[]>([]);

  readonly filter = signal<PriorityFilter>('tutte');
  readonly showAll = signal(false);
  readonly showAllTriage = signal(false);
  /** Actions in flight, so that a double click cannot run twice. */
  private readonly busy = new Set<string>();

  readonly late = computed(() => this.checks().filter((c) => this.controlsService.bucket(c) === 'scaduti'));
  private readonly dueToday = computed(() => this.checks().filter((c) => this.controlsService.bucket(c) === 'oggi'));

  readonly toEvaluate = computed(() =>
    this.ideas()
      .filter((i) => i.stato === 'idea' || i.stato === 'da_valutare')
      .sort((a, b) => String(a['created']).localeCompare(String(b['created']))),
  );
  readonly unsorted = computed(() => this.toEvaluate().filter((i) => !i.priorita));
  readonly byPriority = computed(() => {
    const by = { alta: [] as Idea[], media: [] as Idea[], bassa: [] as Idea[] };
    for (const i of this.toEvaluate()) if (i.priorita) by[i.priorita].push(i);
    return by;
  });
  readonly triageRows = computed(() => (this.showAllTriage() ? this.unsorted() : this.unsorted().slice(0, 2)));

  /** The priority groups to show, capped at a few ideas while "Tutte" is selected. */
  readonly groups = computed(() => {
    const f = this.filter();
    const by = this.byPriority();
    const order: { key: IdeaPriority; label: string }[] = [
      { key: 'alta', label: 'ALTA' },
      { key: 'media', label: 'MEDIA' },
      { key: 'bassa', label: 'BASSA' },
    ];
    const wanted = f === 'tutte' ? order : order.filter((g) => g.key === f);
    let room = f === 'tutte' && !this.showAll() ? COLLAPSED_IDEAS : Infinity;
    let hidden = 0;
    const groups = wanted
      .map((g) => {
        const all = by[g.key];
        const items = all.slice(0, room);
        room -= items.length;
        hidden += all.length - items.length;
        return { ...g, items };
      })
      .filter((g) => g.items.length);
    return { groups, hidden };
  });

  readonly openRequests = computed(() =>
    this.requests()
      .filter((r) => OPEN_REQUEST.includes(r.stato))
      .sort((a, b) => String(a.data || a['created']).localeCompare(String(b.data || b['created']))),
  );
  readonly requestRows = computed(() => this.openRequests().slice(0, 3));
  readonly lastClosed = computed(() =>
    this.requests()
      .filter((r) => r.stato === 'fatta')
      .sort((a, b) => String(b['updated']).localeCompare(String(a['updated'])))[0],
  );

  readonly ready = computed(() => {
    const withPurchase = new Set(this.purchases().map((p) => p.idea).filter(Boolean));
    return this.ideas().filter((i) => i.stato === 'approvata' && !withPurchase.has(i.id)).slice(0, 3);
  });
  readonly proposed = computed(() => this.ideas().filter((i) => i.stato === 'proposta').length);
  readonly budget = computed(() => this.purchasesService.totals(this.purchases()));
  private readonly budgetService = inject(BudgetService);
  readonly bv = computed(() => this.budgetService.view(this.purchases()));
  readonly bvProgress = computed(() => {
    const b = this.bv();
    return b ? Math.min(100, Math.round(((b.spent + b.ordered) / b.annual) * 100)) : 0;
  });
  readonly progress = computed(() => {
    const b = this.budget();
    const total = b.spent + b.remaining;
    return total ? Math.min(100, Math.round((b.spent / total) * 100)) : 0;
  });

  readonly summary = computed(() => {
    const l = this.late().length;
    const t = this.dueToday().length;
    const controls =
      l || t
        ? [l ? plural(l, 'controllo in ritardo', 'controlli in ritardo') : '', t ? `${t} da fare oggi` : ''].filter(Boolean).join(', ')
        : 'Nessun controllo da fare oggi';
    const r = this.openRequests().length;
    const u = this.unsorted().length;
    return [
      controls,
      r ? plural(r, 'richiesta aperta', 'richieste aperte') : 'nessuna richiesta aperta',
      u ? plural(u, 'idea da smistare', 'idee da smistare') : 'nessuna idea da smistare',
    ].join(' · ');
  });

  async ngOnInit(): Promise<void> {
    void this.budgetService.load();
    const [ideas, checks, lastRun, requests, purchases] = await Promise.all([
      this.ideasService.list(),
      this.controlsService.list(),
      this.controlsService.lastRuns(),
      this.requestsService.list(),
      this.purchasesService.list(),
    ]);
    this.ideas.set(ideas);
    this.checks.set(checks);
    this.lastRun.set(lastRun);
    this.requests.set(requests);
    this.purchases.set(purchases);
  }

  // --- checks -----------------------------------------------------------------------------
  tone(c: Check): CheckTone {
    const d = diffDays(this.today, toDay(c.prossima_scadenza));
    return d < 0 ? 'late' : d === 0 ? 'today' : d <= 7 ? 'soon' : 'later';
  }

  lateDays(c: Check): string {
    const d = -diffDays(this.today, toDay(c.prossima_scadenza));
    return plural(d, 'giorno', 'giorni');
  }

  dueLabel(c: Check): string {
    const d = diffDays(this.today, toDay(c.prossima_scadenza));
    if (d < 0) return `In ritardo · ${this.lateDays(c)}`;
    if (d === 0) return 'Oggi';
    if (d === 1) return 'Domani';
    if (d < 14) return `Tra ${d} giorni`;
    if (d < 60) return `Tra ${Math.round(d / 7)} settimane`;
    return `Tra ${Math.round(d / 30)} mesi`;
  }

  checkSub(c: Check): string {
    const freq = FREQUENCY[c.frequenza] ?? c.frequenza;
    const tone = this.tone(c);
    if (tone === 'late' || tone === 'today') {
      const last = this.lastRun()[c.id];
      return `${freq} · ${last ? 'ultimo il ' + shortDay(last) : 'mai eseguito'}`;
    }
    const due = toDay(c.prossima_scadenza);
    return `${freq} · ${weekdayName(due)} ${shortDay(due)}`;
  }

  async done(check: Check): Promise<void> {
    const key = 'check:' + check.id;
    if (this.busy.has(key)) return;
    this.busy.add(key);
    try {
      await this.controlsService.markDone(check.id);
      const [checks, lastRun] = await Promise.all([this.controlsService.list(), this.controlsService.lastRuns()]);
      this.checks.set(checks);
      this.lastRun.set(lastRun);
    } finally {
      this.busy.delete(key);
    }
  }

  // --- ideas ------------------------------------------------------------------------------
  setFilter(f: PriorityFilter): void {
    this.filter.set(f);
    this.showAll.set(false);
  }

  areaOf(i: Idea): string {
    return i.expand?.area?.nome ?? '';
  }

  private ageDays(i: Idea): number {
    return Math.max(0, diffDays(toDay(String(i['created'])), this.today));
  }

  addedLabel(i: Idea): string {
    const d = this.ageDays(i);
    if (d === 0) return 'aggiunta oggi';
    if (d === 1) return 'aggiunta ieri';
    if (d < 7) return `${d} giorni fa`;
    return `${Math.round(d / 7)} settimane fa`;
  }

  sinceLabel(i: Idea): string {
    const d = this.ageDays(i);
    if (d === 0) return 'da oggi';
    if (d < 7) return `da ${plural(d, 'giorno', 'giorni')}`;
    if (d < 30) return `da ${plural(Math.round(d / 7), 'settimana', 'settimane')}`;
    return `da ${plural(Math.round(d / 30), 'mese', 'mesi')}`;
  }

  async setPriority(idea: Idea, priority: IdeaPriority): Promise<void> {
    const key = 'idea:' + idea.id;
    if (this.busy.has(key)) return;
    this.busy.add(key);
    try {
      const updated = await this.ideasService.update(idea.id, { priorita: priority });
      this.ideas.update((list) => list.map((x) => (x.id === updated.id ? updated : x)));
    } finally {
      this.busy.delete(key);
    }
  }

  // --- requests ---------------------------------------------------------------------------
  initials(r: WorkRequest): string {
    const letters = (r.richiedente || '').split(/\s+/).filter(Boolean).map((w) => w[0]);
    return (letters.slice(0, 2).join('') || '?').toUpperCase();
  }

  requestStatus(r: WorkRequest): string {
    return labelOf(REQUEST_STATUSES, r.stato).toLowerCase();
  }

  requestSince(r: WorkRequest): string {
    const day = toDay(r.data || String(r['created']));
    const d = diffDays(day, this.today);
    if (d <= 0) return 'oggi';
    if (d < 7) return weekdayName(day);
    return shortDay(day);
  }

  async closeRequest(r: WorkRequest): Promise<void> {
    const key = 'request:' + r.id;
    if (this.busy.has(key)) return;
    this.busy.add(key);
    try {
      const updated = await this.requestsService.update(r.id, { stato: 'fatta' });
      this.requests.update((list) => list.map((x) => (x.id === updated.id ? updated : x)));
    } finally {
      this.busy.delete(key);
    }
  }

  // --- purchases --------------------------------------------------------------------------
  async createPurchase(idea: Idea): Promise<void> {
    const key = 'buy:' + idea.id;
    if (this.busy.has(key)) return;
    this.busy.add(key);
    try {
      await this.purchasesService.convert(idea.id);
      this.purchases.set(await this.purchasesService.list());
    } finally {
      this.busy.delete(key);
    }
  }
}
