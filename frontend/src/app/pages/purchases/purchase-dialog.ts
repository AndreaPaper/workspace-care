import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Area, Idea, PURCHASE_STATUSES, Purchase, PurchaseStatus } from '../../models/models';
import { PurchasesService } from '../../services/purchases.service';

/** Create or edit a purchase. Closes with the saved purchase, or 'deleted'. */
@Component({
  selector: 'app-purchase-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>{{ data.purchase ? 'Acquisto' : 'Nuovo acquisto' }}</h2>
    <form (ngSubmit)="save()">
      <mat-dialog-content class="form">
        <mat-form-field>
          <mat-label>Articolo</mat-label>
          <input matInput name="articolo" [(ngModel)]="articolo" required />
        </mat-form-field>
        <div class="two">
          <mat-form-field>
            <mat-label>Area</mat-label>
            <mat-select name="area" [(ngModel)]="area">
              <mat-option value="">(nessuna)</mat-option>
              @for (a of data.areas; track a.id) { <mat-option [value]="a.id">{{ a.nome }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Stato</mat-label>
            <mat-select name="stato" [(ngModel)]="stato">
              @for (s of statuses; track s.value) { <mat-option [value]="s.value">{{ s.label }}</mat-option> }
            </mat-select>
          </mat-form-field>
        </div>
        <div class="two">
          <mat-form-field>
            <mat-label>Quantità</mat-label>
            <input matInput type="number" min="1" name="quantita" [(ngModel)]="quantita" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Fornitore</mat-label>
            <input matInput name="fornitore" [(ngModel)]="fornitore" />
          </mat-form-field>
        </div>
        <mat-form-field>
          <mat-label>Link</mat-label>
          <input matInput type="url" name="link" [(ngModel)]="link" />
        </mat-form-field>
        <p class="hint">Stime e prezzo sono totali della riga, quantità già compresa.</p>
        <div class="three">
          <mat-form-field>
            <mat-label>Stima min (€)</mat-label>
            <input matInput type="number" min="0" name="stima_min" [(ngModel)]="stimaMin" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Stima max (€)</mat-label>
            <input matInput type="number" min="0" name="stima_max" [(ngModel)]="stimaMax" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Prezzo effettivo (€)</mat-label>
            <input matInput type="number" min="0" name="prezzo" [(ngModel)]="prezzo" />
          </mat-form-field>
        </div>
        <mat-form-field>
          <mat-label>Idea collegata</mat-label>
          <mat-select name="idea" [(ngModel)]="idea">
            <mat-option value="">(nessuna)</mat-option>
            @for (i of data.ideas; track i.id) { <mat-option [value]="i.id">{{ i.titolo }}</mat-option> }
          </mat-select>
        </mat-form-field>
        @if (error()) { <small class="error">{{ error() }}</small> }
      </mat-dialog-content>
      <mat-dialog-actions>
        @if (data.purchase) { <button mat-button type="button" class="danger" (click)="remove()">Elimina</button> }
        <span class="spacer"></span>
        <button mat-button type="button" mat-dialog-close>Annulla</button>
        <button mat-flat-button type="submit" [disabled]="!articolo.trim() || saving()">Salva</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .form { display: flex; flex-direction: column; gap: .25rem; padding-top: .5rem !important; }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem; }
    .three { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: .5rem; }
    .hint { margin: 0 0 .25rem; color: var(--mat-sys-on-surface-variant); font-size: .85rem; }
    mat-dialog-actions { display: flex; }
    .spacer { flex: 1; }
    .danger, .error { color: var(--mat-sys-error); }
    @media (max-width: 520px) { .two, .three { grid-template-columns: 1fr; } }
  `,
})
export class PurchaseDialog {
  private readonly purchases = inject(PurchasesService);
  private readonly ref = inject<MatDialogRef<PurchaseDialog, Purchase | 'deleted'>>(MatDialogRef);
  readonly data = inject<{ purchase?: Purchase; areas: Area[]; ideas: Idea[] }>(MAT_DIALOG_DATA);

  readonly statuses = PURCHASE_STATUSES;
  articolo = this.data.purchase?.articolo ?? '';
  area = this.data.purchase?.area ?? '';
  stato: PurchaseStatus = this.data.purchase?.stato ?? 'da_proporre';
  quantita = this.data.purchase?.quantita || 1;
  fornitore = this.data.purchase?.fornitore ?? '';
  link = this.data.purchase?.link ?? '';
  stimaMin: number | null = this.data.purchase?.stima_min || null;
  stimaMax: number | null = this.data.purchase?.stima_max || null;
  prezzo: number | null = this.data.purchase?.prezzo_effettivo || null;
  idea = this.data.purchase?.idea ?? '';
  readonly saving = signal(false);
  readonly error = signal('');

  async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    const payload: Partial<Purchase> = {
      articolo: this.articolo.trim(),
      area: this.area,
      stato: this.stato,
      quantita: Number(this.quantita) || 1,
      fornitore: this.fornitore.trim(),
      link: this.link.trim(),
      stima_min: Number(this.stimaMin) || 0,
      stima_max: Number(this.stimaMax) || 0,
      prezzo_effettivo: Number(this.prezzo) || 0,
      idea: this.idea,
    };
    try {
      const saved = this.data.purchase
        ? await this.purchases.update(this.data.purchase.id, payload)
        : await this.purchases.create(payload);
      this.ref.close(saved);
    } catch {
      this.error.set("Impossibile salvare l'acquisto (controlla che il link sia un URL valido).");
      this.saving.set(false);
    }
  }

  async remove(): Promise<void> {
    if (!this.data.purchase || !confirm('Eliminare questo acquisto?')) return;
    await this.purchases.remove(this.data.purchase.id);
    this.ref.close('deleted');
  }
}
