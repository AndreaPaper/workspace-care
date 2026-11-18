import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { IDEA_PRIORITIES, Idea, labelOf } from '../../models/models';
import { IdeasService } from '../../services/ideas.service';

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
        <mat-card-header><mat-card-title>Idee da valutare</mat-card-title></mat-card-header>
        <mat-card-content>
          @for (idea of toEvaluate(); track idea.id) {
            <a class="row" [routerLink]="['/idee', idea.id]">
              <span>{{ idea.titolo }}</span>
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
        <mat-card-header><mat-card-title>Controlli in scadenza</mat-card-title></mat-card-header>
        <mat-card-content><p class="muted">Disponibile nella fase 2.</p></mat-card-content>
      </mat-card>
      <mat-card>
        <mat-card-header><mat-card-title>Richieste aperte</mat-card-title></mat-card-header>
        <mat-card-content><p class="muted">Disponibile nella fase 2.</p></mat-card-content>
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
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; }
    mat-card-content { padding-top: .75rem; }
    .row { display: flex; justify-content: space-between; gap: 1rem; padding: .5rem 0; border-bottom: 1px solid var(--mat-sys-outline-variant); color: inherit; text-decoration: none; }
    .meta { display: flex; gap: .5rem; align-items: center; color: var(--mat-sys-on-surface-variant); font-size: .9rem; }
  `,
})
export class Dashboard implements OnInit {
  private readonly ideas = inject(IdeasService);
  readonly toEvaluate = signal<Idea[]>([]);

  async ngOnInit(): Promise<void> {
    this.toEvaluate.set(await this.ideas.list('stato = "da_valutare"'));
  }

  priority(value: string): string {
    return labelOf(IDEA_PRIORITIES, value);
  }
}
