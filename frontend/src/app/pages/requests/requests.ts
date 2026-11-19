import { Component, computed, inject, DestroyRef, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { watchPageParams } from '../../core/page-params';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Area, Idea, REQUEST_STATUSES, WorkRequest, labelOf } from '../../models/models';
import { AreasService } from '../../services/areas.service';
import { formatDay, toDay } from '../../services/dates';
import { IdeasService } from '../../services/ideas.service';
import { RequestsService } from '../../services/requests.service';
import { RequestDialog } from './request-dialog';

@Component({
  selector: 'app-requests',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, MatTableModule],
  template: `
    <div class="head">
      <h1>Richieste</h1>
      <button mat-flat-button (click)="open()"><mat-icon>add</mat-icon> Nuova richiesta</button>
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
          <mat-option value="aperte">Aperte</mat-option>
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
      <ng-container matColumnDef="data">
        <th mat-header-cell *matHeaderCellDef>Data</th>
        <td mat-cell *matCellDef="let r">{{ day(r.data) }}</td>
      </ng-container>
      <ng-container matColumnDef="titolo">
        <th mat-header-cell *matHeaderCellDef>Titolo</th>
        <td mat-cell *matCellDef="let r"><strong>{{ r.titolo }}</strong></td>
      </ng-container>
      <ng-container matColumnDef="richiedente">
        <th mat-header-cell *matHeaderCellDef>Richiedente</th>
        <td mat-cell *matCellDef="let r">{{ r.richiedente }}</td>
      </ng-container>
      <ng-container matColumnDef="area">
        <th mat-header-cell *matHeaderCellDef>Area</th>
        <td mat-cell *matCellDef="let r">{{ r.expand?.area?.nome }}</td>
      </ng-container>
      <ng-container matColumnDef="stato">
        <th mat-header-cell *matHeaderCellDef>Stato</th>
        <td mat-cell *matCellDef="let r"><span class="chip" [class.ok]="r.stato === 'fatta'" [class.bad]="r.stato === 'non_fattibile'">{{ status(r) }}</span></td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns" (click)="open(row)" class="clickable"></tr>
    </table>
    @if (!filtered().length) { <p class="muted">Nessuna richiesta.</p> }
  `,
  styles: `
    .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .head h1 { margin: 0; }
    .filters { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: 1rem; }
    table { width: 100%; }
    .clickable { cursor: pointer; }
    .clickable:hover { background: var(--mat-sys-surface-container-low); }
    @media (max-width: 700px) { .mat-column-richiedente, .mat-column-area { display: none; } }
  `,
})
export class Requests implements OnInit {
  private readonly requestsService = inject(RequestsService);
  private readonly areasService = inject(AreasService);
  private readonly ideasService = inject(IdeasService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly columns = ['data', 'titolo', 'richiedente', 'area', 'stato'];
  readonly statuses = REQUEST_STATUSES;
  readonly requests = signal<WorkRequest[]>([]);
  readonly areas = signal<Area[]>([]);
  private ideas: Idea[] = [];
  readonly search = signal('');
  readonly statusFilter = signal('aperte');
  readonly areaFilter = signal('');

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const open = ['ricevuta', 'in_valutazione', 'in_corso'];
    return this.requests().filter(
      (r) =>
        (!q || (r.titolo + ' ' + r.richiedente).toLowerCase().includes(q)) &&
        (!this.areaFilter() || r.area === this.areaFilter()) &&
        (!this.statusFilter() ||
          (this.statusFilter() === 'aperte' ? open.includes(r.stato) : r.stato === this.statusFilter())),
    );
  });

  async ngOnInit(): Promise<void> {
    const [requests, areas, ideas] = await Promise.all([
      this.requestsService.list(),
      this.areasService.list(),
      this.ideasService.list(),
    ]);
    this.requests.set(requests);
    this.areas.set(areas);
    this.ideas = ideas;
    watchPageParams(this.route, this.router, this.destroyRef, { onNew: () => this.open(), onSearch: (q) => { this.search.set(q); this.statusFilter.set(''); }, });
  }

  day(value: string): string {
    return formatDay(toDay(value));
  }

  status(r: WorkRequest): string {
    return labelOf(REQUEST_STATUSES, r.stato);
  }

  open(request?: WorkRequest): void {
    this.dialog
      .open(RequestDialog, { data: { request, areas: this.areas(), ideas: this.ideas }, width: '34rem', maxWidth: '95vw' })
      .afterClosed()
      .subscribe(async (res?: WorkRequest | 'deleted') => {
        if (res) this.requests.set(await this.requestsService.list());
      });
  }
}
