import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Area, CHECK_FREQUENCIES, CHECK_OUTCOMES, Check, CheckFrequency, CheckOutcome, WEEKDAYS } from '../../models/models';
import { ControlsService } from '../../services/controls.service';

/** Create or edit a periodic check. Closes with the saved Check, or 'deleted'. */
@Component({
  selector: 'app-check-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>{{ data.check ? 'Modifica controllo' : 'Nuovo controllo' }}</h2>
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
          <mat-label>Frequenza</mat-label>
          <mat-select name="frequenza" [(ngModel)]="frequenza" (selectionChange)="onFrequencyChange()">
            @for (f of frequencies; track f.value) { <mat-option [value]="f.value">{{ f.label }}</mat-option> }
          </mat-select>
        </mat-form-field>
        @if (frequenza === 'settimanale') {
          <mat-form-field>
            <mat-label>Giorno della settimana</mat-label>
            <mat-select name="giorno" [(ngModel)]="giorno">
              @for (d of weekdays; track d.value) { <mat-option [value]="d.value">{{ d.label }}</mat-option> }
            </mat-select>
          </mat-form-field>
        } @else {
          <mat-form-field>
            <mat-label>Giorno del mese (1–28)</mat-label>
            <input matInput type="number" name="giorno" min="1" max="28" [(ngModel)]="giorno" required />
          </mat-form-field>
        }
        @if (error()) { <small class="error">{{ error() }}</small> }
      </mat-dialog-content>
      <mat-dialog-actions>
        @if (data.check) { <button mat-button type="button" class="danger" (click)="remove()">Elimina</button> }
        <span class="spacer"></span>
        <button mat-button type="button" mat-dialog-close>Annulla</button>
        <button mat-flat-button type="submit" [disabled]="!nome.trim() || saving()">Salva</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .form { display: flex; flex-direction: column; gap: .5rem; padding-top: .5rem !important; }
    .spacer { flex: 1; }
    .danger, .error { color: var(--mat-sys-error); }
    mat-dialog-actions { display: flex; }
  `,
})
export class CheckDialog {
  private readonly controls = inject(ControlsService);
  private readonly ref = inject<MatDialogRef<CheckDialog, Check | 'deleted'>>(MatDialogRef);
  readonly data = inject<{ check?: Check; areas: Area[] }>(MAT_DIALOG_DATA);

  readonly frequencies = CHECK_FREQUENCIES;
  readonly weekdays = WEEKDAYS;
  nome = this.data.check?.nome ?? '';
  area = this.data.check?.area ?? '';
  frequenza: CheckFrequency = this.data.check?.frequenza ?? 'settimanale';
  giorno = this.data.check?.giorno ?? 1;
  readonly saving = signal(false);
  readonly error = signal('');

  onFrequencyChange(): void {
    // Weekdays go 1-7, months 1-28: keep the value valid for the new meaning.
    this.giorno = Math.min(Math.max(this.giorno, 1), this.frequenza === 'settimanale' ? 7 : 28);
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set('');
    const payload = { nome: this.nome.trim(), area: this.area, frequenza: this.frequenza, giorno: Number(this.giorno) };
    try {
      const saved = this.data.check
        ? await this.controls.update(this.data.check.id, payload)
        : await this.controls.create(payload);
      this.ref.close(saved);
    } catch {
      this.error.set('Impossibile salvare il controllo.');
      this.saving.set(false);
    }
  }

  async remove(): Promise<void> {
    if (!this.data.check || !confirm('Eliminare questo controllo e il suo storico?')) return;
    await this.controls.remove(this.data.check.id);
    this.ref.close('deleted');
  }
}

/** Asks for outcome and an optional note before marking a check as done. */
@Component({
  selector: 'app-done-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>{{ data.nome }}</h2>
    <mat-dialog-content class="form">
      <mat-form-field>
        <mat-label>Esito</mat-label>
        <mat-select [(ngModel)]="esito">
          @for (o of outcomes; track o.value) { <mat-option [value]="o.value">{{ o.label }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field>
        <mat-label>Note (opzionale)</mat-label>
        <textarea matInput rows="3" [(ngModel)]="note"></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Annulla</button>
      <button mat-flat-button [mat-dialog-close]="{ esito, note }">Fatto</button>
    </mat-dialog-actions>
  `,
  styles: `.form { display: flex; flex-direction: column; gap: .5rem; padding-top: .5rem !important; }`,
})
export class DoneDialog {
  readonly data = inject<{ nome: string }>(MAT_DIALOG_DATA);
  readonly outcomes = CHECK_OUTCOMES;
  esito: CheckOutcome = 'ok';
  note = '';
}
