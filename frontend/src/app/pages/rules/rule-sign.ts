import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { RULE_TOPICS, Rule, labelOf } from '../../models/models';
import { todayDay } from '../../services/dates';
import { RulesService } from '../../services/rules.service';

/** Printable sign ("cartello") with the active rules of one topic, in large type. */
@Component({
  selector: 'app-rule-sign',
  imports: [RouterLink],
  template: `
    <div class="bar no-print">
      <a routerLink="/regole" class="back">← Regole</a>
      <button type="button" class="primary" (click)="exportPdf()" [disabled]="exporting()">Esporta PDF</button>
    </div>

    <section class="sign">
      <h1>{{ title() }}</h1>
      <ul>
        @for (r of rules(); track r.id) { <li>{{ r.testo }}</li> } @empty { <li class="empty">Nessuna regola attiva per questo tema.</li> }
      </ul>
    </section>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 18px; }
    .bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .back { color: #0f3b6e; font-weight: 700; }
    .primary { height: 44px; padding: 0 20px; border: 0; border-radius: 999px; background: #2e6a4f; color: #fff; font: 700 14px Inter, system-ui, sans-serif; cursor: pointer; }
    .primary:disabled { opacity: .5; }
    .sign { background: #fff; border-radius: 24px; padding: 40px 48px; }
    h1 { margin: 0 0 24px; font: 800 48px 'Plus Jakarta Sans', Inter, sans-serif; }
    ul { margin: 0; padding-left: 1.2em; display: flex; flex-direction: column; gap: 18px; }
    li { font-size: 28px; line-height: 1.35; white-space: pre-wrap; }
    .empty { list-style: none; margin-left: -1.2em; font-size: 20px; color: #5a5c53; }
    @media (max-width: 800px) { .sign { padding: 24px 20px; } h1 { font-size: 32px; } li { font-size: 20px; } }
    @media print { .sign { border-radius: 0; padding: 0; } li { break-inside: avoid; } }
  `,
})
export class RuleSign implements OnInit {
  private readonly service = inject(RulesService);
  readonly exporting = signal(false);
  readonly rules = signal<Rule[]>([]);
  private readonly topic = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((p) => p.get('tema') ?? '')), { initialValue: '' });

  readonly title = computed(() => labelOf(RULE_TOPICS, this.topic()));

  async ngOnInit(): Promise<void> {
    try {
      const all = await this.service.list();
      this.rules.set(all.filter((r) => r.stato === 'attiva' && r.tema === this.topic()));
    } catch {
      this.rules.set([]);
    }
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
      await bridge.exportPdf(`cartello-${this.topic() || 'regole'}-${todayDay()}.pdf`);
    } finally {
      this.exporting.set(false);
    }
  }
}
