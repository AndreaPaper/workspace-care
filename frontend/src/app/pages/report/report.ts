import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
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
  { value: '30', label: 'Ultimi 30 giorni' },
  { value: '90', label: 'Ultimi 90 giorni' },
  { value: '365', label: 'Ultimo anno' },
  { value: 'tutto', label: 'Tutto' },
];

@Component({
  selector: 'app-report',
  imports: [CurrencyPipe, FormsModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatIconModule, MatSelectModule],
  template: `
    <div class="options no-print">
      <h1>Riepilogo per la direzione</h1>
      <div class="row">
        <mat-form-field>
          <mat-label>Periodo</mat-label>
          <mat-select [value]="period()" (selectionChange)="period.set($event.value); reload()">
            @for (p of periods; track p.value) { <mat-option [value]="p.value">{{ p.label }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <button mat-flat-button (click)="exportPdf()" [disabled]="exporting()"><mat-icon>picture_as_pdf</mat-icon> Esporta PDF</button>
      </div>
      <div class="checks">
        <mat-checkbox [checked]="show.ideas()" (change)="show.ideas.set($event.checked)">Proposte e lavori</mat-checkbox>
        <mat-checkbox [checked]="show.purchases()" (change)="show.purchases.set($event.checked)">Acquisti</mat-checkbox>
        <mat-checkbox [checked]="show.checks()" (change)="show.checks.set($event.checked)">Controlli</mat-checkbox>
        <mat-checkbox [checked]="show.requests()" (change)="show.requests.set($event.checked)">Richieste</mat-checkbox>
        <mat-checkbox [checked]="show.rules()" (change)="show.rules.set($event.checked)">Regole attive</mat-checkbox>
        <mat-checkbox [checked]="show.costs()" (change)="show.costs.set($event.checked)">Mostra i costi</mat-checkbox>
      </div>
    </div>

    <article class="report">
      <header>
        <h1>Workspace Care – riepilogo</h1>
        <p class="muted">{{ periodLabel() }} · generato il {{ today() }}</p>
      </header>

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
                <li>{{ r.titolo }} <span class="muted">({{ r.richiedente }}, {{ label(requestStatuses, r.stato).toLowerCase() }})</span></li>
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
  `,
  styles: `
    .options { margin-bottom: 1.5rem; }
    .row { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
    .checks { display: flex; gap: 1rem; flex-wrap: wrap; }
    .report { max-width: 860px; background: #fff; color: #111; padding: 1.5rem 2rem; border: 1px solid var(--mat-sys-outline-variant); border-radius: 8px; }
    .report h1 { font-size: 1.5rem; margin: 0; }
    .report h2 { font-size: 1.15rem; margin: 1.5rem 0 .5rem; border-bottom: 2px solid #4f46e5; padding-bottom: .2rem; }
    section { break-inside: avoid-page; }
    .idea { display: flex; gap: .75rem; margin-bottom: .75rem; break-inside: avoid; }
    .thumb { flex: 0 0 96px; height: 72px; border-radius: 6px; background: #f1f5f9 center/cover no-repeat; }
    .meta { color: #475569; font-size: .9rem; }
    .desc { font-size: .9rem; }
    table { width: 100%; border-collapse: collapse; font-size: .9rem; }
    th, td { text-align: left; padding: .3rem .4rem; border-bottom: 1px solid #e2e8f0; }
    .num { text-align: right; white-space: nowrap; }
    .totals { margin-top: .5rem; }
    .chip { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  `,
})
export class Report implements OnInit {
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
    const p = PERIODS.find((x) => x.value === this.period())?.label ?? '';
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
      await bridge.exportPdf(`riepilogo-workspace-care-${todayDay()}.pdf`);
    } finally {
      this.exporting.set(false);
    }
  }
}
