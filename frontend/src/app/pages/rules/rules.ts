import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { watchPageParams } from '../../core/page-params';
import { Area, RULE_STATUSES, RULE_TOPICS, Rule, RuleStatus, RuleTopic } from '../../models/models';
import { AreasService } from '../../services/areas.service';
import { RulesService } from '../../services/rules.service';

const NEXT_STATUS: Record<RuleStatus, RuleStatus | null> = { da_definire: 'bozza', bozza: 'attiva', attiva: null };
const ORDER: Record<RuleStatus, number> = { attiva: 0, bozza: 1, da_definire: 2 };

/** Rules as a board: one box per topic, edited in place (no dialog). */
@Component({
  selector: 'app-rules',
  imports: [FormsModule, NgTemplateOutlet, RouterLink],
  template: `
    <div class="head">
      <div>
        <h1>Regole</h1>
        <p class="sub">Le regole condivise dell'ufficio, per tema. Solo quelle attive finiscono nel riepilogo e nei cartelli.</p>
      </div>
      <button type="button" class="primary" (click)="startNew()">+ Nuova regola</button>
    </div>

    @if (toFix(); as f) {
      <div class="notice" role="status">
        <span>
          <strong>{{ f.total }} {{ f.total === 1 ? 'regola' : 'regole' }} da sistemare:</strong>
          {{ f.drafts }} {{ f.drafts === 1 ? 'bozza' : 'bozze' }} da far approvare e {{ f.todo }} da definire
        </span>
        <button type="button" class="link" (click)="toggleFilter()">{{ onlyToFix() ? 'Mostra tutte' : 'Mostra solo queste' }}</button>
      </div>
    }

    @if (search()) {
      <p class="filter">Filtro: «{{ search() }}» <button type="button" class="link" (click)="search.set('')">Togli il filtro</button></p>
    }

    @if (error()) { <p class="error" role="alert">{{ error() }}</p> }

    <div class="board">
      @for (g of groups(); track g.topic) {
        <section class="box" [attr.aria-label]="g.label">
          <header>
            <h2>{{ g.label }}</h2>
            <a class="sign" [class.off]="!g.active" [routerLink]="g.active ? ['/regole/cartello'] : null" [queryParams]="{ tema: g.topic }"
               [attr.aria-disabled]="g.active ? null : true" title="Stampa le regole attive di questo tema in grande">Cartello</a>
          </header>

          @for (r of g.rules; track r.id) {
            @if (editingId() === r.id) {
              <ng-container *ngTemplateOutlet="form" />
            } @else {
              <article class="rule" [class.active]="r.stato === 'attiva'" [class.draft]="r.stato === 'bozza'" [class.todo]="r.stato === 'da_definire'">
                <div class="meta">
                  @if (r.stato === 'attiva') { <span class="tick" aria-label="Attiva">✓</span> }
                  @else { <span class="tag">{{ r.stato === 'bozza' ? 'Bozza' : 'Da definire' }}</span> }
                </div>
                <button type="button" class="text" (click)="startEdit(r)" [attr.aria-label]="'Modifica la regola: ' + r.testo">{{ r.testo }}</button>
                @if (areaName(r.area); as an) { <span class="areatag">{{ an }}</span> }
                @if (r.stato === 'bozza') { <button type="button" class="act" (click)="advance(r)">Attiva</button> }
                @if (r.stato === 'da_definire') { <button type="button" class="act" (click)="writeDraft(r)">Scrivi la bozza</button> }
              </article>
            }
          }

          @if (editingId() === 'new' && draft.tema === g.topic) {
            <ng-container *ngTemplateOutlet="form" />
          }
        </section>
      } @empty {
        <p class="muted">{{ onlyToFix() ? 'Nessuna regola da sistemare.' : 'Nessuna regola.' }}</p>
      }
    </div>

    <ng-template #form>
      <form class="edit" (ngSubmit)="save()">
        <textarea name="testo" rows="3" [(ngModel)]="draft.testo" aria-label="Testo della regola" required></textarea>
        <div class="row">
          <label>Tema
            <select name="tema" [(ngModel)]="draft.tema">
              @for (t of topics; track t.value) { <option [value]="t.value">{{ t.label }}</option> }
            </select>
          </label>
          <label>Area (facoltativa)
            <select name="area" [(ngModel)]="draft.area">
              <option value="">(nessuna)</option>
              @for (a of areas(); track a.id) { <option [value]="a.id">{{ a.nome }}</option> }
            </select>
          </label>
          <label>Stato
            <select name="stato" [(ngModel)]="draft.stato">
              @for (s of statuses; track s.value) { <option [value]="s.value">{{ s.label }}</option> }
            </select>
          </label>
        </div>
        <div class="row">
          @if (editingId() !== 'new') { <button type="button" class="danger" (click)="remove()">Elimina</button> }
          <span class="grow"></span>
          <button type="button" class="ghost" (click)="cancel()">Annulla</button>
          <button type="submit" class="primary" [disabled]="!draft.testo.trim() || saving()">Salva</button>
        </div>
      </form>
    </ng-template>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 18px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
    h1 { margin: 0; font: 800 30px 'Plus Jakarta Sans', Inter, sans-serif; }
    .sub { margin: 4px 0 0; color: #5a5c53; font-size: 14px; }
    button { font: inherit; cursor: pointer; }
    button:focus-visible, a:focus-visible, select:focus-visible, textarea:focus-visible { outline: 3px solid #2f6fb5; outline-offset: 2px; }
    .primary { height: 44px; padding: 0 20px; border: 0; border-radius: 999px; background: #2e6a4f; color: #fff; font-weight: 700; }
    .primary:disabled { opacity: .5; cursor: default; }
    .ghost { height: 40px; padding: 0 16px; border: 1px solid #cfc9bb; border-radius: 999px; background: #fff; color: #22241f; font-weight: 600; }
    .danger { height: 40px; padding: 0 12px; border: 0; background: transparent; color: #b42318; font-weight: 600; }
    .link { border: 0; background: transparent; color: #0f3b6e; font-weight: 700; text-decoration: underline; padding: 4px; }
    .notice { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 12px 16px; border-radius: 16px; background: #fdf5e4; border: 1px solid #ecd9a6; color: #5c3f00; font-size: 14px; }
    .filter { margin: 0; font-size: 14px; }
    .error { margin: 0; color: #b42318; }
    .muted { color: #5a5c53; }
    .board { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; align-items: start; }
    .box { background: #fff; border-radius: 24px; padding: 18px; display: flex; flex-direction: column; gap: 10px; }
    .box header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .box h2 { margin: 0; font: 800 18px 'Plus Jakarta Sans', Inter, sans-serif; }
    .sign { padding: 6px 14px; border: 1px solid #cfc9bb; border-radius: 999px; color: #22241f; font-size: 13px; font-weight: 600; text-decoration: none; }
    .sign.off { opacity: .45; pointer-events: none; }
    .rule { display: grid; grid-template-columns: auto 1fr; gap: 6px 10px; align-items: start; padding: 12px; border-radius: 14px; border: 1px solid transparent; }
    .rule.active { background: #edf5f0; }
    .rule.draft { border: 1.5px dashed #9a9c92; }
    .rule.todo { border: 1.5px dashed #d6b24a; background: #fffcf4; }
    .meta { min-width: 24px; }
    .tick { display: inline-flex; width: 22px; height: 22px; border-radius: 999px; background: #2e6a4f; color: #fff; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; }
    .tag { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #efebe3; font-size: 12px; font-weight: 700; white-space: nowrap; }
    .todo .tag { background: #fbefc8; color: #5c3f00; }
    .text { border: 0; background: transparent; padding: 0; text-align: left; color: #22241f; font-size: 15px; line-height: 1.45; white-space: pre-wrap; }
    .text:hover { text-decoration: underline dotted; }
    .areatag { grid-column: 2; justify-self: start; font-size: 12px; color: #5a5c53; }
    .act { grid-column: 2; justify-self: start; height: 36px; padding: 0 14px; border: 1px solid #2e6a4f; border-radius: 999px; background: #fff; color: #173d2b; font-weight: 700; font-size: 13px; }
    .edit { display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 14px; border: 1.5px solid #2f6fb5; background: #f5f9fe; }
    .edit textarea { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #cfc9bb; border-radius: 10px; font: 15px/1.45 Inter, system-ui, sans-serif; resize: vertical; }
    .row { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
    .row label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: #45473f; }
    .row select { height: 36px; border: 1px solid #cfc9bb; border-radius: 8px; padding: 0 8px; font: 14px Inter, system-ui, sans-serif; background: #fff; }
    .grow { flex: 1; }
    @media (max-width: 800px) { h1 { font-size: 26px; } .board { grid-template-columns: 1fr; } }
  `,
})
export class Rules implements OnInit {
  private readonly service = inject(RulesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly topics = RULE_TOPICS;
  readonly statuses = RULE_STATUSES;
  readonly rules = signal<Rule[]>([]);
  readonly search = signal('');
  readonly error = signal('');
  readonly saving = signal(false);
  /** Id of the rule being edited, 'new' for a rule being created, '' for none. */
  readonly editingId = signal('');
  readonly areas = signal<Area[]>([]);
  private readonly areasService = inject(AreasService);
  draft: { tema: RuleTopic; stato: RuleStatus; testo: string; area: string } = { tema: 'altro', stato: 'bozza', testo: '', area: '' };

  readonly onlyToFix = toSignal(this.route.queryParamMap.pipe(map((p) => p.get('da_sistemare') === '1')), { initialValue: false });

  /** Drafts waiting for approval and rules still to be written (null when there is nothing to fix). */
  readonly toFix = computed(() => {
    const drafts = this.rules().filter((r) => r.stato === 'bozza').length;
    const todo = this.rules().filter((r) => r.stato === 'da_definire').length;
    return drafts + todo ? { drafts, todo, total: drafts + todo } : null;
  });

  readonly groups = computed(() => {
    const q = this.search().trim().toLowerCase();
    const creating = this.editingId() === 'new';
    return RULE_TOPICS.map((t) => {
      const all = this.rules().filter((r) => r.tema === t.value);
      const rules = all
        .filter((r) => (!this.onlyToFix() || r.stato !== 'attiva' || r.id === this.editingId()) && (!q || r.testo.toLowerCase().includes(q)))
        .sort((a, b) => ORDER[a.stato] - ORDER[b.stato]);
      return { topic: t.value, label: t.label, rules, active: all.some((r) => r.stato === 'attiva') };
    }).filter((g) => g.rules.length || (creating && g.topic === this.draft.tema));
  });

  async ngOnInit(): Promise<void> {
    await this.reload();
    watchPageParams(this.route, this.router, this.destroyRef, {
      onNew: () => this.startNew(),
      onSearch: (q) => this.search.set(q),
    });
  }

  private async reload(): Promise<void> {
    try {
      const [rules, areas] = await Promise.all([this.service.list(), this.areasService.list()]);
      this.rules.set(rules);
      this.areas.set(areas);
    } catch {
      this.error.set('Impossibile caricare le regole.');
    }
  }

  toggleFilter(): void {
    void this.router.navigate([], { queryParams: { da_sistemare: this.onlyToFix() ? null : 1 }, queryParamsHandling: 'merge' });
  }

  areaName(id: string): string {
    return this.areas().find((a) => a.id === id)?.nome ?? '';
  }

  startNew(): void {
    this.error.set('');
    this.draft = { tema: 'altro', stato: 'bozza', testo: '', area: '' };
    this.editingId.set('new');
  }

  startEdit(r: Rule): void {
    this.error.set('');
    this.draft = { tema: r.tema, stato: r.stato, testo: r.testo, area: r.area ?? '' };
    this.editingId.set(r.id);
  }

  cancel(): void {
    this.editingId.set('');
  }

  async save(): Promise<void> {
    if (this.saving() || !this.draft.testo.trim()) return;
    this.saving.set(true);
    this.error.set('');
    const payload = { tema: this.draft.tema, stato: this.draft.stato, testo: this.draft.testo.trim(), area: this.draft.area };
    try {
      if (this.editingId() === 'new') await this.service.create(payload);
      else await this.service.update(this.editingId(), payload);
      this.editingId.set('');
      await this.reload();
    } catch {
      this.error.set('Impossibile salvare la regola.');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(): Promise<void> {
    const id = this.editingId();
    if (!id || id === 'new' || !confirm('Eliminare questa regola?')) return;
    try {
      await this.service.remove(id);
      this.editingId.set('');
      await this.reload();
    } catch {
      this.error.set('Impossibile eliminare la regola.');
    }
  }

  async advance(r: Rule): Promise<void> {
    const next = NEXT_STATUS[r.stato];
    if (!next) return;
    try {
      await this.service.update(r.id, { stato: next });
      await this.reload();
    } catch {
      this.error.set('Impossibile aggiornare la regola.');
    }
  }

  /** "Scrivi la bozza": moves the rule to draft and opens its text for editing. */
  async writeDraft(r: Rule): Promise<void> {
    try {
      const saved = await this.service.update(r.id, { stato: 'bozza' });
      await this.reload();
      this.startEdit(saved);
    } catch {
      this.error.set('Impossibile aggiornare la regola.');
    }
  }
}
