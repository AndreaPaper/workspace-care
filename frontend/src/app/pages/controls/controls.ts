import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { MasterDetail } from '../../core/ui/master-detail';
import { PageHead } from '../../core/ui/page-head';
import { NEW_ID, pinFirstSelection, selectedIdFromUrl, selectItem } from '../../core/ui/selection';
import { watchPageParams } from '../../core/page-params';
import { Area, CHECK_FREQUENCIES, Check, CheckFrequency, CheckOutcome, CheckRun, WEEKDAYS } from '../../models/models';
import { AreasService } from '../../services/areas.service';
import { ControlsService } from '../../services/controls.service';
import { diffDays, longDay, shortDay, todayDay, toDay, weekdayName } from '../../services/dates';
import { nextAfterDone } from '../../services/scadenze';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const HISTORY_SHORT = 4;
const HISTORY_ALL = 50;

interface Draft {
  nome: string;
  area: string;
  frequenza: CheckFrequency;
  giorno: number;
}

@Component({
  selector: 'app-controls',
  imports: [FormsModule, NgTemplateOutlet, MatIconModule, MasterDetail, PageHead],
  template: `
    <app-page-head title="Controlli">
      <button type="button" class="btn btn-outline" (click)="startNew()"><mat-icon aria-hidden="true">add</mat-icon> Nuovo controllo</button>
    </app-page-head>

    <app-master-detail listLabel="Elenco controlli" detailLabel="Dettaglio controllo">
      <ng-container list>
        <span class="order">Ordinati per scadenza</span>
        @for (c of checks(); track c.id) {
          <a class="md-item" [class.sel]="c.id === current()?.id" [class.late]="days(c) < 0" role="button" tabindex="0" (click)="select(c.id)" (keydown.enter)="select(c.id)" [attr.aria-current]="c.id === current()?.id ? 'true' : null">
            <span class="grow">
              <strong class="t">{{ c.nome }}</strong>
              <span class="s">{{ listSub(c) }}</span>
            </span>
            @if (days(c) < 0) {
              <span class="md-chip small solid-bad">{{ -days(c) }} gg di ritardo</span>
            } @else if (days(c) === 0) {
              <span class="md-chip small warn">Oggi</span>
            } @else {
              <span class="r">{{ dueShort(c) }}</span>
            }
          </a>
        } @empty {
          <p class="md-empty">Nessun controllo. Creane uno con «Nuovo controllo».</p>
        }
      </ng-container>

      <ng-container detail>
        @if (isNew()) {
          <div class="md-head"><div><h2 class="md-title">Nuovo controllo</h2></div></div>
          <ng-container *ngTemplateOutlet="form" />
          <div class="md-actions">
            <button type="button" class="btn btn-primary" [disabled]="!draft.nome.trim() || busy()" (click)="create()">Crea controllo</button>
            <button type="button" class="btn btn-ghost" (click)="select(null)">Annulla</button>
          </div>
        } @else if (current(); as c) {
          <div class="md-head">
            <div>
              <span [class]="'md-chip ' + tone(c)">{{ statusLabel(c) }}</span>
              <h2 class="md-title">{{ c.nome }}</h2>
              <span class="md-sub">{{ detailSub(c) }}</span>
            </div>
            <button type="button" class="icon-btn" aria-label="Modifica controllo" (click)="startEdit(c)"><mat-icon aria-hidden="true">edit</mat-icon></button>
          </div>

          @if (editing()) {
            <ng-container *ngTemplateOutlet="form" />
            <div class="md-actions">
              <button type="button" class="btn btn-primary" [disabled]="!draft.nome.trim() || busy()" (click)="saveEdit(c)">Salva</button>
              <button type="button" class="btn btn-outline" (click)="editing.set(false)">Annulla</button>
              <button type="button" class="btn btn-ghost btn-danger-text push" (click)="remove(c)">Elimina controllo</button>
            </div>
          } @else {
            <div class="register">
              <strong>Com'è andata oggi?</strong>
              <div class="outcomes" role="group" aria-label="Esito">
                <button type="button" class="opt ok" [attr.aria-pressed]="outcome === 'ok'" (click)="outcome = 'ok'"><mat-icon aria-hidden="true">check</mat-icon> Tutto a posto</button>
                <button type="button" class="opt fix" [attr.aria-pressed]="outcome === 'da_sistemare'" (click)="outcome = 'da_sistemare'"><mat-icon aria-hidden="true">build</mat-icon> Da sistemare</button>
              </div>
              <label class="md-field">
                <span>Nota <small>(facoltativa)</small></span>
                <textarea rows="2" name="nota" placeholder="Es. buttato cibo scaduto, pulito il ripiano in basso" [(ngModel)]="note"></textarea>
              </label>
              <div class="reg-actions">
                <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="register(c)">Registra</button>
                <span class="md-sub">Il prossimo sarà {{ nextLabel(c) }}</span>
              </div>
              @if (message()) { <span class="ok-msg" role="status">{{ message() }}</span> }
              @if (error()) { <p class="md-error" role="alert">{{ error() }}</p> }
            </div>

            <div>
              <h3 class="md-h3">Storico</h3>
              @for (r of history(); track r.id) {
                <div class="hist">
                  <span class="d">{{ shortDay(toDay(r.data)) }}</span>
                  <span [class]="'md-chip small ' + (r.esito === 'da_sistemare' ? 'warn' : 'ok')">{{ r.esito === 'da_sistemare' ? 'Da sistemare' : 'Tutto a posto' }}</span>
                  <span class="n">{{ r.note }}</span>
                </div>
              } @empty {
                <p class="md-empty">Nessuna esecuzione registrata.</p>
              }
              @if (historyLimit() === 4 && history().length === 4) {
                <button type="button" class="md-more" (click)="showAllHistory(c)">Tutto lo storico</button>
              }
            </div>
          }
        } @else {
          <p class="md-empty">Nessun controllo selezionato.</p>
        }
      </ng-container>
    </app-master-detail>

    <ng-template #form>
      <div class="md-form">
        <label class="md-field wide"><span>Nome</span><input type="text" name="nome" [(ngModel)]="draft.nome" required /></label>
        <label class="md-field">
          <span>Area</span>
          <select name="area" [(ngModel)]="draft.area">
            <option value="">(nessuna)</option>
            @for (a of areas(); track a.id) { <option [value]="a.id">{{ a.nome }}</option> }
          </select>
        </label>
        <label class="md-field">
          <span>Frequenza</span>
          <select name="frequenza" [ngModel]="draft.frequenza" (ngModelChange)="changeFrequency($event)">
            @for (f of frequencies; track f.value) { <option [value]="f.value">{{ f.label }}</option> }
          </select>
        </label>
        @if (usesWeekday(draft.frequenza)) {
          <label class="md-field">
            <span>Giorno della settimana</span>
            <select name="giorno" [(ngModel)]="draft.giorno">
              @for (d of weekdays; track d.value) { <option [value]="d.value">{{ d.label }}</option> }
            </select>
          </label>
        } @else {
          <label class="md-field">
            <span>Giorno del mese (1–28)</span>
            <input type="number" name="giorno" min="1" max="28" [(ngModel)]="draft.giorno" />
          </label>
        }
      </div>
      @if (error()) { <p class="md-error" role="alert">{{ error() }}</p> }
    </ng-template>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 20px; }
    .order { padding: 4px 6px 0; font-size: 12px; color: #55584f; }
    .register { padding: 20px; border-radius: 20px; background: #f6f2ea; display: flex; flex-direction: column; gap: 14px; }
    .register > strong { font-size: 16px; }
    .outcomes { display: flex; flex-wrap: wrap; gap: 10px; }
    .opt { flex: 1 1 180px; display: flex; align-items: center; justify-content: center; gap: 8px; height: 56px; border-radius: 16px; background: #fff; font: 700 15px Inter, system-ui, sans-serif; cursor: pointer; border: 2px solid #d9d3c5; color: #45473f; }
    .opt.ok { border-color: #c5d9cc; color: #173d2b; }
    .opt.fix { border-color: #e6d3a6; color: #6e4700; }
    .opt.ok[aria-pressed='true'] { border-color: #2e6a4f; background: #edf5f0; }
    .opt.fix[aria-pressed='true'] { border-color: #d9a441; background: #fbebc8; }
    .opt:focus-visible { outline: 3px solid #2f6fb5; outline-offset: 2px; }
    .md-field small { font-weight: 400; color: #55584f; }
    .reg-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
    .ok-msg { font-size: 13px; font-weight: 600; color: #245a41; }
    .hist { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #efebe3; }
    .hist .d { width: 56px; font-size: 13px; color: #45473f; flex: none; }
    .hist .n { flex: 1; min-width: 0; font-size: 13px; color: #3a3c36; overflow-wrap: anywhere; }
    @media (max-width: 600px) { .hist { flex-wrap: wrap; } .hist .n { flex-basis: 100%; } }
  `,
})
export class Controls implements OnInit {
  private readonly controlsService = inject(ControlsService);
  private readonly areasService = inject(AreasService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly frequencies = CHECK_FREQUENCIES;
  readonly weekdays = WEEKDAYS;
  readonly shortDay = shortDay;
  readonly toDay = toDay;

  readonly checks = signal<Check[]>([]);
  readonly areas = signal<Area[]>([]);
  private readonly lastRun = signal<Record<string, string>>({});
  readonly history = signal<CheckRun[]>([]);
  readonly historyLimit = signal(HISTORY_SHORT);
  readonly editing = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  outcome: CheckOutcome = 'ok';
  note = '';
  draft: Draft = this.emptyDraft();

  private readonly selectedId = selectedIdFromUrl(this.route);
  readonly isNew = computed(() => this.selectedId() === NEW_ID);
  readonly current = computed(() => {
    if (this.isNew()) return null;
    return this.checks().find((c) => c.id === this.selectedId()) ?? this.checks()[0] ?? null;
  });

  constructor() {
    pinFirstSelection(this.router, this.selectedId, computed(() => this.checks()[0]?.id));
    effect(() => {
      const id = this.current()?.id;
      untracked(() => {
        this.editing.set(false);
        this.error.set('');
        this.message.set('');
        this.outcome = 'ok';
        this.note = '';
        this.historyLimit.set(HISTORY_SHORT);
        void this.loadHistory(id, HISTORY_SHORT);
      });
    });
  }

  async ngOnInit(): Promise<void> {
    const [checks, areas, lastRun] = await Promise.all([
      this.controlsService.list(),
      this.areasService.list(),
      this.controlsService.lastRuns(),
    ]);
    this.checks.set(checks);
    this.areas.set(areas);
    this.lastRun.set(lastRun);
    watchPageParams(this.route, this.router, this.destroyRef, { onNew: () => this.startNew() });
  }

  // --- list and labels ----------------------------------------------------------------------
  select(id: string | null): void {
    selectItem(this.router, id);
  }

  days(c: Check): number {
    return diffDays(todayDay(), toDay(c.prossima_scadenza));
  }

  tone(c: Check): string {
    const d = this.days(c);
    return d < 0 ? 'bad' : d === 0 ? 'warn' : 'ok';
  }

  private frequencyShort(c: Check): string {
    return { settimanale: 'Ogni settimana', bisettimanale: 'Ogni 2 settimane', mensile: 'Ogni mese', trimestrale: 'Ogni 3 mesi' }[c.frequenza] ?? c.frequenza;
  }

  listSub(c: Check): string {
    return [this.frequencyShort(c), c.expand?.area?.nome].filter(Boolean).join(' · ');
  }

  dueShort(c: Check): string {
    const d = this.days(c);
    return d <= 30 ? `tra ${d} gg` : shortDay(toDay(c.prossima_scadenza));
  }

  statusLabel(c: Check): string {
    const d = this.days(c);
    const due = toDay(c.prossima_scadenza);
    if (d < 0) return `In ritardo di ${plural(-d, 'giorno', 'giorni')} · previsto il ${shortDay(due)}`;
    if (d === 0) return 'Da fare oggi';
    return `Prossimo ${longDay(due)}`;
  }

  private article(giorno: number): string {
    return giorno === 7 ? 'la' : 'il';
  }

  usesWeekday(f: CheckFrequency): boolean {
    return f === 'settimanale' || f === 'bisettimanale';
  }

  detailSub(c: Check): string {
    const wd = WEEKDAYS.find((w) => w.value === c.giorno)?.label.toLowerCase() ?? '';
    const rule =
      c.frequenza === 'settimanale' ? `ogni settimana, ${this.article(c.giorno)} ${wd}`
      : c.frequenza === 'bisettimanale' ? `ogni 2 settimane, ${this.article(c.giorno)} ${wd}`
      : c.frequenza === 'mensile' ? `ogni mese, il giorno ${c.giorno}`
      : `ogni 3 mesi, il giorno ${c.giorno}`;
    const last = this.lastRun()[c.id];
    return [c.expand?.area?.nome, rule, last ? `ultimo il ${shortDay(last)}` : 'mai eseguito'].filter(Boolean).join(' · ');
  }

  nextLabel(c: Check): string {
    const day = nextAfterDone(c.frequenza, c.giorno);
    return `${weekdayName(day)} ${shortDay(day)}`;
  }

  // --- history ------------------------------------------------------------------------------
  private async loadHistory(id: string | undefined, limit: number): Promise<void> {
    this.history.set(id ? await this.controlsService.history(id, limit) : []);
  }

  async showAllHistory(c: Check): Promise<void> {
    this.historyLimit.set(HISTORY_ALL);
    await this.loadHistory(c.id, HISTORY_ALL);
  }

  // --- registering --------------------------------------------------------------------------
  private async reload(): Promise<void> {
    const [checks, lastRun] = await Promise.all([this.controlsService.list(), this.controlsService.lastRuns()]);
    this.checks.set(checks);
    this.lastRun.set(lastRun);
  }

  async register(c: Check): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    try {
      const updated = await this.controlsService.markDone(c.id, this.outcome, this.note.trim());
      await this.reload();
      await this.loadHistory(c.id, this.historyLimit());
      this.outcome = 'ok';
      this.note = '';
      const next = toDay(updated.prossima_scadenza);
      this.message.set(`Registrato. Prossimo controllo: ${weekdayName(next)} ${shortDay(next)}.`);
    } catch {
      this.error.set('Impossibile registrare il controllo.');
    } finally {
      this.busy.set(false);
    }
  }

  // --- create, edit, delete -----------------------------------------------------------------
  private emptyDraft(): Draft {
    return { nome: '', area: '', frequenza: 'settimanale', giorno: 1 };
  }

  changeFrequency(f: CheckFrequency): void {
    this.draft.frequenza = f;
    // Weekdays go 1-7, days of the month 1-28: keep the value valid for the new meaning.
    this.draft.giorno = Math.min(Math.max(Number(this.draft.giorno) || 1, 1), this.usesWeekday(f) ? 7 : 28);
  }

  startNew(): void {
    this.draft = this.emptyDraft();
    this.error.set('');
    this.select(NEW_ID);
  }

  startEdit(c: Check): void {
    this.draft = { nome: c.nome, area: c.area ?? '', frequenza: c.frequenza, giorno: c.giorno };
    this.error.set('');
    this.editing.set(true);
  }

  private payload(): Partial<Check> {
    const d = this.draft;
    return { nome: d.nome.trim(), area: d.area, frequenza: d.frequenza, giorno: Number(d.giorno) || 1 };
  }

  async create(): Promise<void> {
    if (this.busy() || !this.draft.nome.trim()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const created = await this.controlsService.create(this.payload());
      await this.reload();
      this.select(created.id);
    } catch {
      this.error.set('Impossibile creare il controllo.');
    } finally {
      this.busy.set(false);
    }
  }

  async saveEdit(c: Check): Promise<void> {
    if (this.busy() || !this.draft.nome.trim()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.controlsService.update(c.id, this.payload());
      await this.reload();
      this.editing.set(false);
    } catch {
      this.error.set('Impossibile salvare il controllo.');
    } finally {
      this.busy.set(false);
    }
  }

  async remove(c: Check): Promise<void> {
    if (this.busy() || !confirm(`Eliminare il controllo «${c.nome}» e il suo storico?`)) return;
    this.busy.set(true);
    try {
      await this.controlsService.remove(c.id);
      await this.reload();
      this.select(null);
    } finally {
      this.busy.set(false);
    }
  }
}
