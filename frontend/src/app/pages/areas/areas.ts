import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { Area } from '../../models/models';
import { AreasService } from '../../services/areas.service';
import { IdeasService } from '../../services/ideas.service';

@Component({
  selector: 'app-areas',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatTableModule],
  template: `
    <h1>Aree</h1>
    <form class="add" (ngSubmit)="add()">
      <mat-form-field>
        <mat-label>Nuova area</mat-label>
        <input matInput name="new" [(ngModel)]="newName" />
      </mat-form-field>
      <button mat-flat-button type="submit" [disabled]="!newName.trim()"><mat-icon>add</mat-icon> Aggiungi</button>
    </form>
    @if (error()) { <p class="error">{{ error() }}</p> }
    <table mat-table [dataSource]="areas()">
      <ng-container matColumnDef="nome">
        <th mat-header-cell *matHeaderCellDef>Nome</th>
        <td mat-cell *matCellDef="let area">
          @if (editingId() === area.id) {
            <input class="edit" [(ngModel)]="editName" (keyup.enter)="saveEdit(area)" />
          } @else { {{ area.nome }} }
        </td>
      </ng-container>
      <ng-container matColumnDef="idee">
        <th mat-header-cell *matHeaderCellDef>Idee</th>
        <td mat-cell *matCellDef="let area">{{ counts()[area.id] ?? 0 }}</td>
      </ng-container>
      <ng-container matColumnDef="azioni">
        <th mat-header-cell *matHeaderCellDef></th>
        <td mat-cell *matCellDef="let area" class="actions">
          @if (editingId() === area.id) {
            <button mat-icon-button (click)="saveEdit(area)" aria-label="Salva"><mat-icon>check</mat-icon></button>
            <button mat-icon-button (click)="editingId.set('')" aria-label="Annulla"><mat-icon>close</mat-icon></button>
          } @else {
            <button mat-icon-button (click)="startEdit(area)" aria-label="Rinomina"><mat-icon>edit</mat-icon></button>
            <button mat-icon-button (click)="remove(area)" aria-label="Elimina"><mat-icon>delete</mat-icon></button>
          }
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>
  `,
  styles: `
    .add { display: flex; gap: .5rem; align-items: center; margin-bottom: .5rem; }
    table { width: 100%; max-width: 640px; }
    .actions { text-align: right; white-space: nowrap; }
    .edit { padding: .4rem; font: inherit; }
    .error { color: var(--mat-sys-error); }
  `,
})
export class Areas implements OnInit {
  private readonly areasService = inject(AreasService);
  private readonly ideasService = inject(IdeasService);

  readonly columns = ['nome', 'idee', 'azioni'];
  readonly areas = signal<Area[]>([]);
  readonly counts = signal<Record<string, number>>({});
  readonly editingId = signal('');
  readonly error = signal('');
  newName = '';
  editName = '';

  ngOnInit(): Promise<void> {
    return this.reload();
  }

  private async reload(): Promise<void> {
    const [areas, counts] = await Promise.all([this.areasService.list(), this.ideasService.countByArea()]);
    this.areas.set(areas);
    this.counts.set(counts);
  }

  async add(): Promise<void> {
    this.error.set('');
    const name = this.newName.trim();
    try {
      await this.areasService.create(name);
      this.newName = '';
    } catch {
      this.error.set(`Impossibile aggiungere "${name}": esiste già un'area con questo nome.`);
    }
    await this.reload();
  }

  startEdit(area: Area): void {
    this.editName = area.nome;
    this.editingId.set(area.id);
    // The input only exists after change detection; focus and select it for quick renaming.
    setTimeout(() => document.querySelector<HTMLInputElement>('input.edit')?.select());
  }

  async saveEdit(area: Area): Promise<void> {
    this.error.set('');
    const name = this.editName.trim();
    if (name && name !== area.nome) {
      try {
        await this.areasService.rename(area.id, name);
      } catch {
        // Keep the field open so the name can be corrected.
        this.error.set(`Impossibile rinominare in "${name}": esiste già un'area con questo nome.`);
        return;
      }
    }
    this.editingId.set('');
    await this.reload();
  }

  async remove(area: Area): Promise<void> {
    this.error.set('');
    const n = this.counts()[area.id] ?? 0;
    if (n > 0) {
      this.error.set(`Impossibile eliminare "${area.nome}": ha ${n} idee collegate.`);
      return;
    }
    if (!confirm(`Eliminare l'area "${area.nome}"?`)) return;
    try {
      await this.areasService.remove(area.id);
    } catch {
      this.error.set(`Impossibile eliminare "${area.nome}": è usata da altri elementi.`);
    }
    await this.reload();
  }
}
