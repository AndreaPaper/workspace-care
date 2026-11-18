import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { Area, Idea, PURCHASE_STATUSES, Purchase, PurchaseStatus } from '../../models/models';
import { AreasService } from '../../services/areas.service';
import { IdeasService } from '../../services/ideas.service';
import { PurchasesService } from '../../services/purchases.service';
import { PurchaseDialog } from './purchase-dialog';

@Component({
  selector: 'app-purchases',
  imports: [
    CurrencyPipe, FormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule,
    MatInputModule, MatSelectModule, MatTableModule,
  ],
  template: `
    <div class="head">
      <h1>Acquisti e budget</h1>
      <button mat-flat-button (click)="open()"><mat-icon>add</mat-icon> Nuovo acquisto</button>
    </div>

    <div class="totals">
      <mat-card><span class="label">Stimato</span><strong>{{ t().estimateMin | currency: 'EUR' : 'symbol' : '1.0-0' }} – {{ t().estimateMax | currency: 'EUR' : 'symbol' : '1.0-0' }}</strong></mat-card>
      <mat-card><span class="label">Speso</span><strong>{{ t().spent | currency: 'EUR' : 'symbol' : '1.0-0' }}</strong></mat-card>
      <mat-card><span class="label">Ancora da spendere</span><strong>{{ t().remaining | currency: 'EUR' : 'symbol' : '1.0-0' }}</strong></mat-card>
      <mat-card><span class="label">Da ordinare</span><strong>{{ t().toOrder }}</strong></mat-card>
    </div>

    <div class="filters">
      <mat-form-field>
        <mat-label>Cerca</mat-label>
        <input matInput [ngModel]="search()" (ngModelChange)="search.set($event)" />
      </mat-form-field>
      <mat-form-field>
        <mat-label>Stato</mat-label>
        <mat-select [value]="statusFilter()" (selectionChange)="statusFilter.set($event.value)">
          <mat-option value="">Tutti</mat-option>
          @for (s of statuses; track s.value) { <mat-option [value]="s.value">{{ s.label }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field>
        <mat-label>Area</mat-label>
        <mat-select [value]="areaFilter()" (selectionChange)="areaFilter.set($event.value)">
          <mat-option value="">Tutte</mat-option>
          @for (a of areas(); track a.id) { <mat-option [value]="a.id">{{ a.nome }}</mat-option> }
        </mat-select>
      </mat-form-field>
    </div>

    <table mat-table [dataSource]="filtered()">
      <ng-container matColumnDef="articolo">
        <th mat-header-cell *matHeaderCellDef>Articolo</th>
        <td mat-cell *matCellDef="let p">
          <strong>{{ p.articolo }}</strong>
          @if (p.quantita > 1) { <span class="muted"> × {{ p.quantita }}</span> }
          @if (p.expand?.idea) { <br /><a class="small" [routerLink]="['/idee', p.idea]">{{ p.expand.idea.titolo }}</a> }
        </td>
      </ng-container>
      <ng-container matColumnDef="area">
        <th mat-header-cell *matHeaderCellDef>Area</th>
        <td mat-cell *matCellDef="let p">{{ p.expand?.area?.nome }}</td>
      </ng-container>
      <ng-container matColumnDef="fornitore">
        <th mat-header-cell *matHeaderCellDef>Fornitore</th>
        <td mat-cell *matCellDef="let p">
          @if (p.link) { <a [href]="p.link" target="_blank" rel="noopener">{{ p.fornitore || 'link' }}</a> } @else { {{ p.fornitore }} }
        </td>
      </ng-container>
      <ng-container matColumnDef="prezzo">
        <th mat-header-cell *matHeaderCellDef>Prezzo</th>
        <td mat-cell *matCellDef="let p">
          @if (p.prezzo_effettivo) {
            <strong>{{ p.prezzo_effettivo | currency: 'EUR' : 'symbol' : '1.0-2' }}</strong>
          } @else if (p.stima_min || p.stima_max) {
            <span class="muted">~ {{ p.stima_min | currency: 'EUR' : 'symbol' : '1.0-0' }}–{{ p.stima_max || p.stima_min | currency: 'EUR' : 'symbol' : '1.0-0' }}</span>
          }
        </td>
      </ng-container>
      <ng-container matColumnDef="stato">
        <th mat-header-cell *matHeaderCellDef>Stato</th>
        <td mat-cell *matCellDef="let p">
          <select [ngModel]="p.stato" (ngModelChange)="setStatus(p, $event)" aria-label="Stato">
            @for (s of statuses; track s.value) { <option [value]="s.value">{{ s.label }}</option> }
          </select>
        </td>
      </ng-container>
      <ng-container matColumnDef="azioni">
        <th mat-header-cell *matHeaderCellDef></th>
        <td mat-cell *matCellDef="let p"><button mat-icon-button (click)="open(p)" aria-label="Modifica"><mat-icon>edit</mat-icon></button></td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>
    @if (!filtered().length) { <p class="muted">Nessun acquisto. Puoi crearne uno qui oppure convertire un'idea dal suo dettaglio.</p> }
  `,
  styles: `
    .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .head h1 { margin: 0; }
    .totals { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: .75rem; margin-bottom: 1rem; }
    .totals mat-card { padding: .75rem 1rem; display: flex; flex-direction: column; gap: .25rem; }
    .label { color: var(--mat-sys-on-surface-variant); font-size: .85rem; }
    .totals strong { font-size: 1.25rem; }
    .filters { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: 1rem; }
    table { width: 100%; }
    select { font: inherit; padding: .3rem; border-radius: 6px; border: 1px solid var(--mat-sys-outline-variant); background: transparent; color: inherit; }
    .small { font-size: .85rem; }
    @media (max-width: 800px) { .mat-column-area, .mat-column-fornitore { display: none; } }
  `,
})
export class Purchases implements OnInit {
  private readonly purchasesService = inject(PurchasesService);
  private readonly areasService = inject(AreasService);
  private readonly ideasService = inject(IdeasService);
  private readonly dialog = inject(MatDialog);

  readonly columns = ['articolo', 'area', 'fornitore', 'prezzo', 'stato', 'azioni'];
  readonly statuses = PURCHASE_STATUSES;
  readonly purchases = signal<Purchase[]>([]);
  readonly areas = signal<Area[]>([]);
  private ideas: Idea[] = [];
  readonly search = signal('');
  readonly statusFilter = signal('');
  readonly areaFilter = signal('');

  readonly t = computed(() => this.purchasesService.totals(this.purchases()));
  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.purchases().filter(
      (p) =>
        (!q || (p.articolo + ' ' + p.fornitore).toLowerCase().includes(q)) &&
        (!this.statusFilter() || p.stato === this.statusFilter()) &&
        (!this.areaFilter() || p.area === this.areaFilter()),
    );
  });

  async ngOnInit(): Promise<void> {
    const [purchases, areas, ideas] = await Promise.all([
      this.purchasesService.list(),
      this.areasService.list(),
      this.ideasService.list(),
    ]);
    this.purchases.set(purchases);
    this.areas.set(areas);
    this.ideas = ideas;
  }

  private async reload(): Promise<void> {
    this.purchases.set(await this.purchasesService.list());
  }

  async setStatus(p: Purchase, status: PurchaseStatus): Promise<void> {
    await this.purchasesService.update(p.id, { stato: status });
    await this.reload();
    if (status === 'montato') await this.offerToCompleteIdea(p);
  }

  /** When every purchase of an idea is mounted, offer to mark the idea as done. */
  private async offerToCompleteIdea(p: Purchase): Promise<void> {
    if (!p.idea) return;
    const siblings = this.purchases().filter((x) => x.idea === p.idea);
    const idea = this.ideas.find((i) => i.id === p.idea);
    if (!idea || idea.stato === 'fatta' || !siblings.every((x) => x.stato === 'montato')) return;
    if (confirm(`Tutti gli acquisti di "${idea.titolo}" sono montati. Segnare l'idea come fatta?`)) {
      const updated = await this.ideasService.update(idea.id, { stato: 'fatta' });
      this.ideas = this.ideas.map((i) => (i.id === updated.id ? updated : i));
    }
  }

  open(purchase?: Purchase): void {
    this.dialog
      .open(PurchaseDialog, { data: { purchase, areas: this.areas(), ideas: this.ideas }, width: '36rem', maxWidth: '95vw' })
      .afterClosed()
      .subscribe(async (res?: Purchase | 'deleted') => {
        if (!res) return;
        await this.reload();
        if (res !== 'deleted' && res.stato === 'montato') await this.offerToCompleteIdea(res);
      });
  }
}
