import { CurrencyPipe } from '@angular/common';
import { AfterViewInit, Component, DestroyRef, ElementRef, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IDEA_STATUSES, Idea, PURCHASE_STATUSES, Purchase, REQUEST_STATUSES, RULE_TOPICS, Rule, WorkRequest, labelOf,
} from '../../models/models';
import { ControlsService } from '../../services/controls.service';
import { addDays, formatDay, todayDay, toDay } from '../../services/dates';
import { IdeaLinksService } from '../../services/idea-links.service';
import { IdeasService } from '../../services/ideas.service';
import { PurchasesService } from '../../services/purchases.service';
import { RequestsService } from '../../services/requests.service';
import { RulesService } from '../../services/rules.service';

type Run = Awaited<ReturnType<ControlsService['runsSince']>>[number];

const PERIODS = [
  { value: '30', label: 'Ultimo mese', long: 'Ultimi 30 giorni' },
  { value: '90', label: 'Ultimi 3 mesi', long: 'Ultimi 90 giorni' },
  { value: '365', label: 'Ultimo anno', long: 'Ultimo anno' },
  { value: 'tutto', label: 'Tutto', long: 'Tutto' },
];

const LAST_EXPORT_KEY = 'wc-report-last-export';

function readLastExport(): string {
  try { return localStorage.getItem(LAST_EXPORT_KEY) ?? ''; } catch { return ''; }
}

@Component({
  selector: 'app-report',
  imports: [CurrencyPipe, FormsModule],
  template: `
    <div class="layout">
      <aside class="settings no-print">
        <h1>Riepilogo</h1>
        <p class="sub">Per la direzione · scegli cosa mettere nel foglio</p>

        <div class="group" role="group" aria-label="Periodo">
          <span class="cap">Periodo</span>
          <div class="seg">
            @for (p of periods; track p.value) {
              <button type="button" [attr.aria-pressed]="period() === p.value" (click)="setPeriod(p.value)">{{ p.label }}</button>
            }
          </div>
        </div>

        <div class="group">
          <span class="cap">Sezioni</span>
          <div class="checks">
            <label><input type="checkbox" [checked]="show.ideas()" (change)="show.ideas.set(on($event))" /> <span>Proposte e lavori</span><b>{{ activeIdeas().length + doneIdeas().length }}</b></label>
            <label><input type="checkbox" [checked]="show.purchases()" (change)="show.purchases.set(on($event))" /> <span>Acquisti</span><b>{{ purchases().length }}</b></label>
            <label><input type="checkbox" [checked]="show.checks()" (change)="show.checks.set(on($event))" /> <span>Controlli</span><b>{{ runs().length }} eseguiti</b></label>
            <label><input type="checkbox" [checked]="show.requests()" (change)="show.requests.set(on($event))" /> <span>Richieste</span><b>{{ requestsReceived().length }}</b></label>
            <label><input type="checkbox" [checked]="show.rules()" (change)="show.rules.set(on($event))" /> <span>Regole attive</span><b>{{ rules().length }}</b></label>
          </div>
          <label class="costs"><input type="checkbox" [checked]="show.costs()" (change)="show.costs.set(on($event))" /> <span>Mostra i costi</span></label>
        </div>

        <div class="group">
          <label class="cap" for="intro">Due righe di apertura (facoltative)</label>
          <textarea id="intro" rows="3" [ngModel]="intro()" (ngModelChange)="intro.set($event)" placeholder="Es. Questo mese ci siamo concentrati su…"></textarea>
        </div>

        <button type="button" class="export" (click)="exportPdf()" [disabled]="exporting()">Esporta PDF</button>
        <p class="hint">circa {{ pages() }} {{ pages() === 1 ? 'pagina' : 'pagine' }} A4@if (lastExport()) { · ultimo invio il {{ lastExport() }} }</p>
      </aside>

      <div class="stage">
    <article class="report" #sheet>
      <header>
        <h1>Workspace Care – riepilogo</h1>
        <p class="muted">{{ periodLabel() }} · generato il {{ today() }}</p>
        @if (intro().trim()) { <p class="intro">{{ intro().trim() }}</p> }
      </header>

      <div class="kpis">
        <div><b>{{ doneIdeas().length }}</b><span>lavori fatti</span></div>
        @if (show.costs()) { <div><b>{{ totals().spent | currency: 'EUR' : 'symbol' : '1.0-0' }}</b><span>spesi</span></div> }
        <div><b>{{ runs().length }}</b><span>controlli</span></div>
        <div><b>{{ requestsHandled().length }}</b><span>richieste chiuse</span></div>
      </div>

      @if (show.ideas()) {
        <section>
          <h2>Proposte e lavori in corso</h2>
          @for (i of activeIdeas(); track i.id) {
            <div class="idea">
              <div class="thumb" [style.background-image]="cover(i)"></div>
              <div>
                <strong>{{ i.titolo }}</strong>
                <div class="meta">
                  {{ i.expand?.area?.nome }} · <span class="chip">{{ label(statuses, i.stato) }}</span>
                  @if (show.costs() && (i.costo_min || i.costo_max)) { · € {{ i.costo_min || 0 }} – {{ i.costo_max || i.costo_min }} }
                </div>
                @if (i.descrizione) { <div class="desc">{{ i.descrizione }}</div> }
              </div>
            </div>
          } @empty {
            <p class="muted">Nessuna proposta attiva.</p>
          }
          @if (doneIdeas().length) {
            <h3>Completate nel periodo</h3>
            <ul>
              @for (i of doneIdeas(); track i.id) { <li>{{ i.titolo }} <span class="muted">({{ i.expand?.area?.nome }})</span></li> }
            </ul>
          }
        </section>
      }

      @if (show.purchases()) {
        <section>
          <h2>Acquisti</h2>
          @if (purchases().length) {
            <div class="scroll">
            <table>
              <thead>
                <tr><th>Articolo</th><th>Area</th><th>Stato</th><th>Fornitore</th>@if (show.costs()) { <th class="num">Importo</th> }</tr>
              </thead>
              <tbody>
                @for (p of purchases(); track p.id) {
                  <tr>
                    <td>{{ p.articolo }}{{ p.quantita > 1 ? ' × ' + p.quantita : '' }}</td>
                    <td>{{ p.expand?.area?.nome }}</td>
                    <td>{{ label(purchaseStatuses, p.stato) }}</td>
                    <td>{{ p.fornitore }}</td>
                    @if (show.costs()) {
                      <td class="num">
                        @if (p.prezzo_effettivo) { {{ p.prezzo_effettivo | currency: 'EUR' : 'symbol' : '1.0-2' }} }
                        @else if (p.stima_min || p.stima_max) { ~ {{ p.stima_min | currency: 'EUR' : 'symbol' : '1.0-0' }}–{{ p.stima_max || p.stima_min | currency: 'EUR' : 'symbol' : '1.0-0' }} }
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
            </div>
            @if (show.costs()) {
              <p class="totals">
                Stimato {{ totals().estimateMin | currency: 'EUR' : 'symbol' : '1.0-0' }}–{{ totals().estimateMax | currency: 'EUR' : 'symbol' : '1.0-0' }}
                · Speso <strong>{{ totals().spent | currency: 'EUR' : 'symbol' : '1.0-0' }}</strong>
                · Ancora da spendere {{ totals().remaining | currency: 'EUR' : 'symbol' : '1.0-0' }}
              </p>
            }
          } @else {
            <p class="muted">Nessun acquisto.</p>
          }
        </section>
      }

      @if (show.checks()) {
        <section>
          <h2>Controlli periodici</h2>
          <p>
            Controlli eseguiti nel periodo: {{ runs().length }}, di cui {{ issues().length }} con esito «da sistemare».
          </p>
          @if (issues().length) {
            <ul>
              @for (r of issues(); track r.id) {
                <li>{{ day(r.data) }} – {{ r.expand?.controllo?.nome }}@if (r.note) { : {{ r.note }} }</li>
              }
            </ul>
          }
        </section>
      }

      @if (show.requests()) {
        <section>
          <h2>Richieste dei colleghi</h2>
          <p>
            {{ requestsReceived().length }} ricevute nel periodo ·
            {{ requestsHandled().length }} concluse ·
            {{ requestsOpen().length }} ancora aperte
          </p>
          @if (requestsOpen().length) {
            <ul>
              @for (r of requestsOpen(); track r.id) {
                <li>{{ r.titolo }} <span class="muted">({{ r.richiedente ? r.richiedente + ', ' : '' }}{{ label(requestStatuses, r.stato).toLowerCase() }})</span></li>
              }
            </ul>
          }
        </section>
      }

      @if (show.rules()) {
        <section>
          <h2>Regole attive</h2>
          @for (r of rules(); track r.id) { <p><strong>{{ label(topics, r.tema) }}</strong>: {{ r.testo }}</p> } @empty { <p class="muted">Nessuna regola attiva.</p> }
        </section>
      }
    </article>
      </div>
    </div>
  `,
  styles: `
    .layout { display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 24px; align-items: start; }
    .settings { display: flex; flex-direction: column; gap: 18px; font-family: Inter, system-ui, sans-serif; }
    .settings h1 { margin: 0; font: 800 30px 'Plus Jakarta Sans', Inter, sans-serif; }
    .sub { margin: -12px 0 0; color: #5a5c53; font-size: 14px; }
    .group { display: flex; flex-direction: column; gap: 8px; }
    .cap { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #45473f; }
    .seg { display: flex; flex-wrap: wrap; gap: 6px; }
    .seg button { height: 40px; padding: 0 14px; border: 1px solid #cfc9bb; border-radius: 999px; background: #fff; color: #22241f; font: 600 13px Inter, system-ui, sans-serif; cursor: pointer; }
    .seg button[aria-pressed='true'] { background: #2e6a4f; border-color: #2e6a4f; color: #fff; }
    .checks { background: #fff; border-radius: 16px; padding: 6px 14px; display: flex; flex-direction: column; }
    .checks label, .costs { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: 14px; cursor: pointer; }
    .checks label span { flex: 1; }
    .checks label b { color: #5a5c53; font-size: 13px; font-weight: 600; }
    .checks label + label { border-top: 1px solid #efebe3; }
    .settings input[type='checkbox'] { width: 18px; height: 18px; accent-color: #2e6a4f; }
    .settings textarea { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #cfc9bb; border-radius: 12px; font: 14px/1.45 Inter, system-ui, sans-serif; resize: vertical; }
    .settings button:focus-visible, .settings input:focus-visible, .settings textarea:focus-visible { outline: 3px solid #2f6fb5; outline-offset: 2px; }
    .export { height: 52px; border: 0; border-radius: 999px; background: #2e6a4f; color: #fff; font: 700 16px Inter, system-ui, sans-serif; cursor: pointer; }
    .export:disabled { opacity: .5; cursor: default; }
    .hint { margin: -10px 0 0; text-align: center; color: #5a5c53; font-size: 13px; }
    .stage { background: #e9e5dc; border-radius: 24px; padding: 28px 16px; display: flex; justify-content: center; }
    .intro { font-style: italic; color: #334155; margin: .6rem 0 0; white-space: pre-wrap; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 8px; margin: 1rem 0 0; }
    .kpis div { background: #f4f2ec; border-radius: 10px; padding: .5rem .7rem; display: flex; flex-direction: column; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .kpis b { font-size: 1.3rem; }
    .kpis span { font-size: .8rem; color: #475569; }
    @media (max-width: 1000px) { .layout { grid-template-columns: minmax(0, 1fr); } .stage { padding: 16px 8px; } }
    @media print {
      .layout { display: block; }
      .stage { background: none; padding: 0; border-radius: 0; display: block; }
      .report { box-shadow: none !important; border: 0 !important; max-width: none !important; border-radius: 0 !important; padding: 0 !important; }
    }
    .report { width: 100%; max-width: 620px; box-sizing: border-box; background: #fff; color: #111; padding: 1.5rem 2rem; box-shadow: 0 2px 10px rgba(60, 50, 30, .15); }
    .report h1 { font-size: 1.5rem; margin: 0; }
    .report h2 { font-size: 1.15rem; margin: 1.5rem 0 .5rem; border-bottom: 2px solid #4f46e5; padding-bottom: .2rem; }
    /* A section can be longer than a page: only keep a heading with the content that follows it. */
    .report h2, .report h3 { break-after: avoid; }
    .report tr { break-inside: avoid; }
    .idea { display: flex; gap: .75rem; margin-bottom: .75rem; break-inside: avoid; }
    .thumb { flex: 0 0 96px; height: 72px; border-radius: 6px; background: #f1f5f9 center/cover no-repeat; }
    .meta { color: #475569; font-size: .9rem; }
    .desc { font-size: .9rem; }
    /* On a phone the purchases table scrolls inside the report instead of widening the whole page. */
    .scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: .9rem; }
    th, td { text-align: left; padding: .3rem .4rem; border-bottom: 1px solid #e2e8f0; }
    .num { text-align: right; white-space: nowrap; }
    .totals { margin-top: .5rem; }
    @media (max-width: 600px) { .report { padding: 1rem; } }
    .chip { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  `,
})
export class Report implements OnInit, AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly sheet = viewChild<ElementRef<HTMLElement>>('sheet');
  readonly intro = signal('');
  readonly pages = signal(1);
  readonly lastExport = signal(readLastExport());
  private readonly ideasService = inject(IdeasService);
  private readonly linksService = inject(IdeaLinksService);
  private readonly purchasesService = inject(PurchasesService);
  private readonly controlsService = inject(ControlsService);
  private readonly requestsService = inject(RequestsService);
  private readonly rulesService = inject(RulesService);

  readonly periods = PERIODS;
  readonly statuses = IDEA_STATUSES;
  readonly purchaseStatuses = PURCHASE_STATUSES;
  readonly requestStatuses = REQUEST_STATUSES;
  readonly topics = RULE_TOPICS;
  readonly period = signal('90');
  readonly exporting = signal(false);
  readonly show = {
    ideas: signal(true),
    purchases: signal(true),
    checks: signal(true),
    requests: signal(true),
    rules: signal(true),
    costs: signal(true),
  };

  private readonly ideas = signal<Idea[]>([]);
  private readonly covers = signal<Record<string, string>>({});
  readonly purchases = signal<Purchase[]>([]);
  readonly runs = signal<Run[]>([]);
  private readonly requests = signal<WorkRequest[]>([]);
  readonly rules = signal<Rule[]>([]);

  /** First day included in the period, or '' for no limit. */
  private readonly since = computed(() => (this.period() === 'tutto' ? '' : addDays(todayDay(), -Number(this.period()))));
  readonly periodLabel = computed(() => {
    const p = PERIODS.find((x) => x.value === this.period())?.long ?? '';
    return this.since() ? `${p} (dal ${formatDay(this.since())})` : p;
  });
  readonly today = computed(() => formatDay(todayDay()));

  readonly activeIdeas = computed(() => this.ideas().filter((i) => ['proposta', 'approvata', 'in_corso'].includes(i.stato)));
  readonly doneIdeas = computed(() =>
    this.ideas().filter((i) => i.stato === 'fatta' && (!this.since() || toDay(i.updated) >= this.since())),
  );
  readonly totals = computed(() => this.purchasesService.totals(this.purchases()));
  readonly issues = computed(() => this.runs().filter((r) => r.esito === 'da_sistemare'));
  readonly requestsReceived = computed(() => this.requests().filter((r) => !this.since() || toDay(r.data) >= this.since()));
  readonly requestsHandled = computed(() =>
    this.requests().filter(
      (r) => ['fatta', 'non_fattibile'].includes(r.stato) && (!this.since() || toDay(r.updated) >= this.since()),
    ),
  );
  readonly requestsOpen = computed(() => this.requests().filter((r) => ['ricevuta', 'in_valutazione', 'in_corso'].includes(r.stato)));

  ngOnInit(): Promise<void> {
    return this.reload();
  }

  /** Keeps the "about N A4 pages" hint in step with the sheet's height. */
  ngAfterViewInit(): void {
    const el = this.sheet()?.nativeElement;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      // The sheet is previewed ~620 px wide but printed on ~700 px of usable A4 width, ~1000 px high.
      const printed = el.scrollHeight * (el.clientWidth / 700);
      this.pages.set(Math.max(1, Math.ceil(printed / 1000)));
    });
    ro.observe(el);
    this.destroyRef.onDestroy(() => ro.disconnect());
  }

  setPeriod(value: string): void {
    this.period.set(value);
    void this.reload();
  }

  on(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  async reload(): Promise<void> {
    const [ideas, links, purchases, runs, requests, rules] = await Promise.all([
      this.ideasService.list(),
      this.linksService.listAll(),
      this.purchasesService.list(),
      this.controlsService.runsSince(this.since()),
      this.requestsService.list(),
      this.rulesService.list(),
    ]);
    const covers: Record<string, string> = {};
    for (const l of links) if (l.immagine && !covers[l.idea]) covers[l.idea] = this.linksService.imageUrl(l);
    this.covers.set(covers);
    this.ideas.set(ideas);
    this.purchases.set(purchases);
    this.runs.set(runs);
    this.requests.set(requests);
    this.rules.set(rules.filter((r) => r.stato === 'attiva'));
  }

  label(list: readonly { value: string; label: string }[], value: string): string {
    return labelOf(list, value);
  }

  day(value: string): string {
    return formatDay(toDay(value));
  }

  cover(idea: Idea): string {
    const url = this.ideasService.coverUrl(idea, this.covers()[idea.id]);
    return url ? `url("${url}")` : 'none';
  }

  /** Inside the desktop app a save dialog writes the PDF; elsewhere the browser print dialog is used. */
  async exportPdf(): Promise<void> {
    const bridge = window.workspaceCare;
    if (!bridge?.exportPdf) {
      window.print();
      return;
    }
    this.exporting.set(true);
    try {
      const saved = await bridge.exportPdf(`riepilogo-workspace-care-${todayDay()}.pdf`);
      if (saved) {
        const stamp = formatDay(todayDay());
        try { localStorage.setItem(LAST_EXPORT_KEY, stamp); } catch { /* optional */ }
        this.lastExport.set(stamp);
      }
    } finally {
      this.exporting.set(false);
    }
  }
}
