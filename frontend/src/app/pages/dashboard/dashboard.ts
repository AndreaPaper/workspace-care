import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { Check, IDEA_PRIORITIES, Idea, WorkRequest, labelOf } from '../../models/models';
import { ControlsService } from '../../services/controls.service';
import { formatDay, toDay } from '../../services/dates';
import { IdeasService } from '../../services/ideas.service';
import { RequestsService } from '../../services/requests.service';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule],
  template: `
    <div class="head">
      <h1>Dashboard</h1>
      <a mat-flat-button routerLink="/idee" [queryParams]="{ nuova: 1 }"><mat-icon>add</mat-icon> Nuova idea</a>
    </div>
    <div class="grid">
      <mat-card>
        <mat-card-header><mat-card-title>Controlli in scadenza</mat-card-title></mat-card-header>
        <mat-card-content>
          @for (c of dueChecks(); track c.id) {
            <div class="row">
              <span class="grow">
                {{ c.nome }}
                <span class="meta" [class.late]="isLate(c)">{{ isLate(c) ? 'scaduto il ' : '' }}{{ day(c.prossima_scadenza) }}</span>
              </span>
              <button mat-stroked-button (click)="done(c)"><mat-icon>check</mat-icon> Fatto</button>
            </div>
          } @empty {
            <p class="muted">Nessun controllo in scadenza questa settimana.</p>
          }
          <a routerLink="/controlli">Tutti i controlli</a>
        </mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-header><mat-card-title>Richieste aperte ({{ openRequests().length }})</mat-card-title></mat-card-header>
        <mat-card-content>
          @for (r of openRequests().slice(0, 5); track r.id) {
            <a class="row link" routerLink="/richieste">
              <span class="grow">{{ r.titolo }}</span>
              <span class="meta">{{ r.richiedente }}</span>
            </a>
          } @empty {
            <p class="muted">Nessuna richiesta aperta.</p>
          }
        </mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-header><mat-card-title>Idee da valutare</mat-card-title></mat-card-header>
        <mat-card-content>
          @for (idea of toEvaluate(); track idea.id) {
            <a class="row link" [routerLink]="['/idee', idea.id]">
              <span class="grow">{{ idea.titolo }}</span>
              <span class="meta">
                {{ idea.expand?.area?.nome }}
                @if (idea.priorita) { <span class="chip">{{ priority(idea.priorita) }}</span> }
              </span>
            </a>
          } @empty {
            <p class="muted">Nessuna idea da valutare.</p>
          }
        </mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-header><mat-card-title>Budget stimato vs speso</mat-card-title></mat-card-header>
        <mat-card-content><p class="muted">Disponibile nella fase 3.</p></mat-card-content>
      </mat-card>
    </div>
  `,
  styles: `
    .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    h1 { margin: 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem; }
    mat-card-content { padding-top: .75rem; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .5rem 0; border-bottom: 1px solid var(--mat-sys-outline-variant); color: inherit; text-decoration: none; }
    .grow { flex: 1; display: flex; flex-direction: column; }
    .meta { display: flex; gap: .5rem; align-items: center; color: var(--mat-sys-on-surface-variant); font-size: .9rem; }
    .grow .meta { display: block; }
    .late { color: var(--mat-sys-error); }
  `,
})
export class Dashboard implements OnInit {
  private readonly ideas = inject(IdeasService);
  private readonly controls = inject(ControlsService);
  private readonly requests = inject(RequestsService);

  readonly toEvaluate = signal<Idea[]>([]);
  readonly dueChecks = signal<Check[]>([]);
  readonly openRequests = signal<WorkRequest[]>([]);

  async ngOnInit(): Promise<void> {
    const [ideas, checks, requests] = await Promise.all([
      this.ideas.list('stato = "da_valutare"'),
      this.controls.list(),
      this.requests.list('stato = "ricevuta" || stato = "in_valutazione" || stato = "in_corso"'),
    ]);
    this.toEvaluate.set(ideas);
    this.dueChecks.set(checks.filter((c) => this.controls.bucket(c) !== 'dopo'));
    this.openRequests.set(requests);
  }

  async done(check: Check): Promise<void> {
    await this.controls.markDone(check.id);
    this.dueChecks.set((await this.controls.list()).filter((c) => this.controls.bucket(c) !== 'dopo'));
  }

  isLate(check: Check): boolean {
    return this.controls.bucket(check) === 'scaduti';
  }

  day(value: string): string {
    return formatDay(toDay(value));
  }

  priority(value: string): string {
    return labelOf(IDEA_PRIORITIES, value);
  }
}
