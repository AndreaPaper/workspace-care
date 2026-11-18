import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Area, CHECK_FREQUENCIES, CHECK_OUTCOMES, Check, CheckRun, WEEKDAYS, labelOf } from '../../models/models';
import { AreasService } from '../../services/areas.service';
import { CheckBucket, ControlsService } from '../../services/controls.service';
import { formatDay, toDay } from '../../services/dates';
import { CheckDialog, DoneDialog } from './check-dialogs';

const SECTIONS: { key: CheckBucket; title: string }[] = [
  { key: 'scaduti', title: 'Scaduti' },
  { key: 'oggi', title: 'Oggi' },
  { key: 'settimana', title: 'Questa settimana' },
  { key: 'dopo', title: 'Più avanti' },
];

@Component({
  selector: 'app-controls',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="head">
      <h1>Controlli periodici</h1>
      <button mat-flat-button (click)="edit()"><mat-icon>add</mat-icon> Nuovo controllo</button>
    </div>

    @for (s of sections; track s.key) {
      @if (grouped()[s.key].length) {
        <h3 [class.late]="s.key === 'scaduti'">{{ s.title }}</h3>
        @for (c of grouped()[s.key]; track c.id) {
          <div class="row">
            <div class="main">
              <strong>{{ c.nome }}</strong>
              <span class="meta">
                {{ c.expand?.area?.nome }} · {{ frequencyLabel(c) }} · scadenza {{ day(c.prossima_scadenza) }}
              </span>
            </div>
            <button mat-flat-button (click)="done(c)"><mat-icon>check</mat-icon> Fatto</button>
            <button mat-icon-button (click)="toggleHistory(c)" aria-label="Storico"><mat-icon>history</mat-icon></button>
            <button mat-icon-button (click)="edit(c)" aria-label="Modifica"><mat-icon>edit</mat-icon></button>
          </div>
          @if (openId() === c.id) {
            <div class="history">
              @for (r of history(); track r.id) {
                <div>
                  {{ day(r.data) }} · <span class="chip" [class.ok]="r.esito === 'ok'" [class.warn]="r.esito === 'da_sistemare'">{{ outcome(r) }}</span>
                  {{ r.note }}
                </div>
              } @empty {
                <span class="muted">Nessuna esecuzione registrata.</span>
              }
            </div>
          }
        }
      }
    } @empty {
      <p class="muted">Nessun controllo.</p>
    }
  `,
  styles: `
    .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: .5rem; }
    .head h1 { margin: 0; }
    .late { color: var(--mat-sys-error); }
    .row { display: flex; align-items: center; gap: .5rem; padding: .6rem 0; border-bottom: 1px solid var(--mat-sys-outline-variant); flex-wrap: wrap; }
    .main { flex: 1; min-width: 200px; display: flex; flex-direction: column; }
    .meta { color: var(--mat-sys-on-surface-variant); font-size: .9rem; }
    .history { padding: .5rem 1rem; background: var(--mat-sys-surface-container-low); border-radius: 8px; display: flex; flex-direction: column; gap: .25rem; margin: .25rem 0; }
  `,
})
export class Controls implements OnInit {
  private readonly controlsService = inject(ControlsService);
  private readonly areasService = inject(AreasService);
  private readonly dialog = inject(MatDialog);

  readonly sections = SECTIONS;
  readonly checks = signal<Check[]>([]);
  readonly areas = signal<Area[]>([]);
  readonly openId = signal('');
  readonly history = signal<CheckRun[]>([]);

  readonly grouped = computed(() => {
    const g: Record<CheckBucket, Check[]> = { scaduti: [], oggi: [], settimana: [], dopo: [] };
    for (const c of this.checks()) g[this.controlsService.bucket(c)].push(c);
    return g;
  });

  async ngOnInit(): Promise<void> {
    const [checks, areas] = await Promise.all([this.controlsService.list(), this.areasService.list()]);
    this.checks.set(checks);
    this.areas.set(areas);
  }

  day(value: string): string {
    return formatDay(toDay(value));
  }

  frequencyLabel(c: Check): string {
    const base = labelOf(CHECK_FREQUENCIES, c.frequenza);
    const when = c.frequenza === 'settimanale' ? (WEEKDAYS.find((d) => d.value === c.giorno)?.label ?? '') : `il ${c.giorno}`;
    return `${base} (${when})`;
  }

  outcome(r: CheckRun): string {
    return labelOf(CHECK_OUTCOMES, r.esito);
  }

  async reload(): Promise<void> {
    this.checks.set(await this.controlsService.list());
    if (this.openId()) this.history.set(await this.controlsService.history(this.openId()));
  }

  done(check: Check): void {
    this.dialog
      .open(DoneDialog, { data: { nome: check.nome }, width: '28rem', maxWidth: '95vw' })
      .afterClosed()
      .subscribe(async (res?: { esito: 'ok' | 'da_sistemare'; note: string }) => {
        if (!res) return;
        await this.controlsService.markDone(check.id, res.esito, res.note);
        await this.reload();
      });
  }

  edit(check?: Check): void {
    this.dialog
      .open(CheckDialog, { data: { check, areas: this.areas() }, width: '28rem', maxWidth: '95vw' })
      .afterClosed()
      .subscribe(async (res?: Check | 'deleted') => {
        if (res) await this.reload();
      });
  }

  async toggleHistory(check: Check): Promise<void> {
    if (this.openId() === check.id) {
      this.openId.set('');
      return;
    }
    this.history.set(await this.controlsService.history(check.id));
    this.openId.set(check.id);
  }
}
