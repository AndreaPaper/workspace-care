import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { Area, InventoryItem } from '../../models/models';
import { AreasService } from '../../services/areas.service';
import { InventoryService } from '../../services/inventory.service';

/** Create or edit an inventory item. Closes with the saved item, or 'deleted'. */
@Component({
  selector: 'app-inventory-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>{{ data.item ? 'Oggetto' : 'Nuovo oggetto' }}</h2>
    <form (ngSubmit)="save()">
      <mat-dialog-content class="form">
        <mat-form-field>
          <mat-label>Nome</mat-label>
          <input matInput name="nome" [(ngModel)]="nome" required />
        </mat-form-field>
        <mat-form-field>
          <mat-label>Area</mat-label>
          <mat-select name="area" [(ngModel)]="area">
            <mat-option value="">(nessuna)</mat-option>
            @for (a of data.areas; track a.id) { <mat-option [value]="a.id">{{ a.nome }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Posizione (es. scaffale alto, armadio a sinistra)</mat-label>
          <input matInput name="posizione" [(ngModel)]="posizione" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>Note</mat-label>
          <textarea matInput name="note" rows="3" [(ngModel)]="note"></textarea>
        </mat-form-field>
        @if (error()) { <small class="error">{{ error() }}</small> }
      </mat-dialog-content>
      <mat-dialog-actions>
        @if (data.item) { <button mat-button type="button" class="danger" (click)="remove()">Elimina</button> }
        <span class="spacer"></span>
        <button mat-button type="button" mat-dialog-close>Annulla</button>
        <button mat-flat-button type="submit" [disabled]="!nome.trim() || saving()">Salva</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .form { display: flex; flex-direction: column; gap: .5rem; padding-top: .5rem !important; }
    mat-dialog-actions { display: flex; }
    .spacer { flex: 1; }
    .danger, .error { color: var(--mat-sys-error); }
  `,
})
export class InventoryDialog {
  private readonly service = inject(InventoryService);
  private readonly ref = inject<MatDialogRef<InventoryDialog, InventoryItem | 'deleted'>>(MatDialogRef);
  readonly data = inject<{ item?: InventoryItem; areas: Area[] }>(MAT_DIALOG_DATA);

  nome = this.data.item?.nome ?? '';
  area = this.data.item?.area ?? '';
  posizione = this.data.item?.posizione ?? '';
  note = this.data.item?.note ?? '';
  readonly saving = signal(false);
  readonly error = signal('');

  async save(): Promise<void> {
    this.saving.set(true);
    const payload = { nome: this.nome.trim(), area: this.area, posizione: this.posizione.trim(), note: this.note };
    try {
      const saved = this.data.item
        ? await this.service.update(this.data.item.id, payload)
        : await this.service.create(payload);
      this.ref.close(saved);
    } catch {
      this.error.set("Impossibile salvare l'oggetto.");
      this.saving.set(false);
    }
  }

  async remove(): Promise<void> {
    if (!this.data.item || !confirm('Eliminare questo oggetto?')) return;
    await this.service.remove(this.data.item.id);
    this.ref.close('deleted');
  }
}

@Component({
  selector: 'app-inventory',
  imports: [
    FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule,
    MatSlideToggleModule, MatTableModule,
  ],
  template: `
    <div class="head">
      <h1>Inventario</h1>
      <button mat-flat-button (click)="open()"><mat-icon>add</mat-icon> Nuovo oggetto</button>
    </div>
    <div class="filters">
      <mat-form-field>
        <mat-label>Cerca</mat-label>
        <input matInput [ngModel]="search()" (ngModelChange)="search.set($event)" />
      </mat-form-field>
      <mat-form-field>
        <mat-label>Area</mat-label>
        <mat-select [value]="areaFilter()" (selectionChange)="areaFilter.set($event.value)">
          <mat-option value="">Tutte</mat-option>
          @for (a of areas(); track a.id) { <mat-option [value]="a.id">{{ a.nome }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-slide-toggle [checked]="grouped()" (change)="grouped.set($event.checked)">Raggruppa per area</mat-slide-toggle>
    </div>

    @for (g of groups(); track g.title) {
      @if (grouped()) { <h3>{{ g.title }} <small class="muted">({{ g.items.length }})</small></h3> }
      <table mat-table [dataSource]="g.items">
        <ng-container matColumnDef="nome">
          <th mat-header-cell *matHeaderCellDef>Nome</th>
          <td mat-cell *matCellDef="let i"><strong>{{ i.nome }}</strong></td>
        </ng-container>
        <ng-container matColumnDef="area">
          <th mat-header-cell *matHeaderCellDef>Area</th>
          <td mat-cell *matCellDef="let i">{{ i.expand?.area?.nome }}</td>
        </ng-container>
        <ng-container matColumnDef="posizione">
          <th mat-header-cell *matHeaderCellDef>Posizione</th>
          <td mat-cell *matCellDef="let i">{{ i.posizione }}</td>
        </ng-container>
        <ng-container matColumnDef="note">
          <th mat-header-cell *matHeaderCellDef>Note</th>
          <td mat-cell *matCellDef="let i">{{ i.note }}</td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns()"></tr>
        <tr mat-row *matRowDef="let row; columns: columns()" (click)="open(row)" class="clickable"></tr>
      </table>
    } @empty {
      <p class="muted">Nessun oggetto in inventario.</p>
    }
  `,
  styles: `
    .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .head h1 { margin: 0; }
    .filters { display: flex; gap: .75rem; flex-wrap: wrap; align-items: center; margin-bottom: 1rem; }
    table { width: 100%; }
    .clickable { cursor: pointer; }
    .clickable:hover { background: var(--mat-sys-surface-container-low); }
    @media (max-width: 700px) { .mat-column-note { display: none; } }
  `,
})
export class Inventory implements OnInit {
  private readonly service = inject(InventoryService);
  private readonly areasService = inject(AreasService);
  private readonly dialog = inject(MatDialog);

  readonly items = signal<InventoryItem[]>([]);
  readonly areas = signal<Area[]>([]);
  readonly search = signal('');
  readonly areaFilter = signal('');
  readonly grouped = signal(false);

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.items().filter(
      (i) =>
        (!q || (i.nome + ' ' + i.posizione + ' ' + i.note).toLowerCase().includes(q)) &&
        (!this.areaFilter() || i.area === this.areaFilter()),
    );
  });

  readonly columns = computed(() => (this.grouped() ? ['nome', 'posizione', 'note'] : ['nome', 'area', 'posizione', 'note']));

  readonly groups = computed(() => {
    const items = this.filtered();
    if (!items.length) return [];
    if (!this.grouped()) return [{ title: 'Tutti', items }];
    const byArea = new Map<string, InventoryItem[]>();
    for (const i of items) {
      const key = i.expand?.area?.nome ?? 'Senza area';
      byArea.set(key, [...(byArea.get(key) ?? []), i]);
    }
    return [...byArea.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([title, list]) => ({ title, items: list }));
  });

  async ngOnInit(): Promise<void> {
    const [items, areas] = await Promise.all([this.service.list(), this.areasService.list()]);
    this.items.set(items);
    this.areas.set(areas);
  }

  open(item?: InventoryItem): void {
    this.dialog
      .open(InventoryDialog, { data: { item, areas: this.areas() }, width: '30rem', maxWidth: '95vw' })
      .afterClosed()
      .subscribe(async (res?: InventoryItem | 'deleted') => {
        if (res) this.items.set(await this.service.list());
      });
  }
}
