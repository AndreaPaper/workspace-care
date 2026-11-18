import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RULE_STATUSES, RULE_TOPICS, Rule, RuleStatus, RuleTopic, labelOf } from '../../models/models';
import { RulesService } from '../../services/rules.service';

/** Create or edit a rule. Closes with the saved rule, or 'deleted'. */
@Component({
  selector: 'app-rule-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>{{ data.rule ? 'Regola' : 'Nuova regola' }}</h2>
    <form (ngSubmit)="save()">
      <mat-dialog-content class="form">
        <div class="two">
          <mat-form-field>
            <mat-label>Tema</mat-label>
            <mat-select name="tema" [(ngModel)]="tema">
              @for (t of topics; track t.value) { <mat-option [value]="t.value">{{ t.label }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Stato</mat-label>
            <mat-select name="stato" [(ngModel)]="stato">
              @for (s of statuses; track s.value) { <mat-option [value]="s.value">{{ s.label }}</mat-option> }
            </mat-select>
          </mat-form-field>
        </div>
        <mat-form-field>
          <mat-label>Testo della regola</mat-label>
          <textarea matInput name="testo" rows="6" [(ngModel)]="testo" required></textarea>
        </mat-form-field>
        @if (error()) { <small class="error">{{ error() }}</small> }
      </mat-dialog-content>
      <mat-dialog-actions>
        @if (data.rule) { <button mat-button type="button" class="danger" (click)="remove()">Elimina</button> }
        <span class="spacer"></span>
        <button mat-button type="button" mat-dialog-close>Annulla</button>
        <button mat-flat-button type="submit" [disabled]="!testo.trim() || saving()">Salva</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .form { display: flex; flex-direction: column; gap: .5rem; padding-top: .5rem !important; }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem; }
    mat-dialog-actions { display: flex; }
    .spacer { flex: 1; }
    .danger, .error { color: var(--mat-sys-error); }
  `,
})
export class RuleDialog {
  private readonly service = inject(RulesService);
  private readonly ref = inject<MatDialogRef<RuleDialog, Rule | 'deleted'>>(MatDialogRef);
  readonly data = inject<{ rule?: Rule }>(MAT_DIALOG_DATA);

  readonly topics = RULE_TOPICS;
  readonly statuses = RULE_STATUSES;
  tema: RuleTopic = this.data.rule?.tema ?? 'altro';
  stato: RuleStatus = this.data.rule?.stato ?? 'bozza';
  testo = this.data.rule?.testo ?? '';
  readonly saving = signal(false);
  readonly error = signal('');

  async save(): Promise<void> {
    this.saving.set(true);
    const payload = { tema: this.tema, stato: this.stato, testo: this.testo.trim() };
    try {
      const saved = this.data.rule
        ? await this.service.update(this.data.rule.id, payload)
        : await this.service.create(payload);
      this.ref.close(saved);
    } catch {
      this.error.set('Impossibile salvare la regola.');
      this.saving.set(false);
    }
  }

  async remove(): Promise<void> {
    if (!this.data.rule || !confirm('Eliminare questa regola?')) return;
    await this.service.remove(this.data.rule.id);
    this.ref.close('deleted');
  }
}

const NEXT_STATUS: Record<RuleStatus, RuleStatus | null> = { da_definire: 'bozza', bozza: 'attiva', attiva: null };

@Component({
  selector: 'app-rules',
  imports: [MatButtonModule, MatCardModule, MatIconModule],
  template: `
    <div class="head">
      <h1>Regole</h1>
      <button mat-flat-button (click)="open()"><mat-icon>add</mat-icon> Nuova regola</button>
    </div>

    @for (g of groups(); track g.topic) {
      <h3>{{ g.label }}</h3>
      <div class="cards">
        @for (r of g.rules; track r.id) {
          <mat-card>
            <mat-card-content>
              <div class="top">
                <span class="chip" [class.ok]="r.stato === 'attiva'" [class.warn]="r.stato === 'bozza'">{{ status(r) }}</span>
              </div>
              <p class="text">{{ r.testo }}</p>
            </mat-card-content>
            <mat-card-actions>
              @if (next(r); as n) {
                <button mat-button (click)="advance(r, n)">Segna come {{ statusLabel(n).toLowerCase() }}</button>
              }
              <button mat-button (click)="open(r)"><mat-icon>edit</mat-icon> Modifica</button>
            </mat-card-actions>
          </mat-card>
        }
      </div>
    } @empty {
      <p class="muted">Nessuna regola.</p>
    }
  `,
  styles: `
    .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: .5rem; }
    .head h1 { margin: 0; }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
    .text { white-space: pre-wrap; margin: .5rem 0 0; }
  `,
})
export class Rules implements OnInit {
  private readonly service = inject(RulesService);
  private readonly dialog = inject(MatDialog);

  readonly rules = signal<Rule[]>([]);

  readonly groups = computed(() => {
    const order: Record<RuleStatus, number> = { attiva: 0, bozza: 1, da_definire: 2 };
    return RULE_TOPICS.map((t) => ({
      topic: t.value,
      label: t.label,
      rules: this.rules()
        .filter((r) => r.tema === t.value)
        .sort((a, b) => order[a.stato] - order[b.stato]),
    })).filter((g) => g.rules.length);
  });

  async ngOnInit(): Promise<void> {
    this.rules.set(await this.service.list());
  }

  status(r: Rule): string {
    return labelOf(RULE_STATUSES, r.stato);
  }

  statusLabel(s: RuleStatus): string {
    return labelOf(RULE_STATUSES, s);
  }

  next(r: Rule): RuleStatus | null {
    return NEXT_STATUS[r.stato];
  }

  async advance(r: Rule, status: RuleStatus): Promise<void> {
    await this.service.update(r.id, { stato: status });
    this.rules.set(await this.service.list());
  }

  open(rule?: Rule): void {
    this.dialog
      .open(RuleDialog, { data: { rule }, width: '34rem', maxWidth: '95vw' })
      .afterClosed()
      .subscribe(async (res?: Rule | 'deleted') => {
        if (res) this.rules.set(await this.service.list());
      });
  }
}
