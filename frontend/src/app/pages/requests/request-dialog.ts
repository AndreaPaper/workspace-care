import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Area, Idea, REQUEST_STATUSES, RequestStatus, WorkRequest } from '../../models/models';
import { toDay, todayDay, toStored } from '../../services/dates';
import { IdeasService } from '../../services/ideas.service';
import { RequestsService } from '../../services/requests.service';

/** Create or edit a colleague request. Closes with the saved request, or 'deleted'. */
@Component({
  selector: 'app-request-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>{{ data.request ? 'Richiesta' : 'Nuova richiesta' }}</h2>
    <form (ngSubmit)="save()">
      <mat-dialog-content class="form">
        <mat-form-field>
          <mat-label>Titolo</mat-label>
          <input matInput name="titolo" [(ngModel)]="titolo" required />
        </mat-form-field>
        <div class="two">
          <mat-form-field>
            <mat-label>Richiedente</mat-label>
            <input matInput name="richiedente" [(ngModel)]="richiedente" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Data</mat-label>
            <input matInput type="date" name="data" [(ngModel)]="giorno" />
          </mat-form-field>
        </div>
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
        <mat-form-field>
          <mat-label>Descrizione</mat-label>
          <textarea matInput name="descrizione" rows="3" [(ngModel)]="descrizione"></textarea>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Note</mat-label>
          <textarea matInput name="note" rows="2" [(ngModel)]="note"></textarea>
        </mat-form-field>
        @if (data.request) {
          <mat-form-field>
            <mat-label>Idea collegata</mat-label>
            <mat-select name="idea" [(ngModel)]="idea">
              <mat-option value="">(nessuna)</mat-option>
              @for (i of data.ideas; track i.id) { <mat-option [value]="i.id">{{ i.titolo }}</mat-option> }
            </mat-select>
          </mat-form-field>
          @if (!idea) {
            <button mat-stroked-button type="button" (click)="createIdea()" [disabled]="saving()">Crea idea da questa richiesta</button>
          }
        }
        @if (error()) { <small class="error">{{ error() }}</small> }
      </mat-dialog-content>
      <mat-dialog-actions>
        @if (data.request) { <button mat-button type="button" class="danger" (click)="remove()">Elimina</button> }
        <span class="spacer"></span>
        <button mat-button type="button" mat-dialog-close>Annulla</button>
        <button mat-flat-button type="submit" [disabled]="!titolo.trim() || saving()">Salva</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .form { display: flex; flex-direction: column; gap: .5rem; padding-top: .5rem !important; }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem; }
    mat-dialog-actions { display: flex; }
    .spacer { flex: 1; }
    .danger, .error { color: var(--mat-sys-error); }
    @media (max-width: 520px) { .two { grid-template-columns: 1fr; } }
  `,
})
export class RequestDialog {
  private readonly requests = inject(RequestsService);
  private readonly ideas = inject(IdeasService);
  private readonly ref = inject<MatDialogRef<RequestDialog, WorkRequest | 'deleted'>>(MatDialogRef);
  readonly data = inject<{ request?: WorkRequest; areas: Area[]; ideas: Idea[] }>(MAT_DIALOG_DATA);

  readonly statuses = REQUEST_STATUSES;
  titolo = this.data.request?.titolo ?? '';
  richiedente = this.data.request?.richiedente ?? '';
  giorno = this.data.request?.data ? toDay(this.data.request.data) : todayDay();
  area = this.data.request?.area ?? '';
  stato: RequestStatus = this.data.request?.stato ?? 'ricevuta';
  descrizione = this.data.request?.descrizione ?? '';
  note = this.data.request?.note ?? '';
  idea = this.data.request?.idea ?? '';
  readonly saving = signal(false);
  readonly error = signal('');

  private payload(): Partial<WorkRequest> {
    return {
      titolo: this.titolo.trim(),
      richiedente: this.richiedente.trim(),
      data: this.giorno ? toStored(this.giorno) : '',
      area: this.area,
      stato: this.stato,
      descrizione: this.descrizione,
      note: this.note,
      idea: this.idea,
    };
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    await this.persist();
  }

  /** Saves the request; callers are responsible for the saving() guard. */
  private async persist(): Promise<void> {
    this.saving.set(true);
    this.error.set('');
    try {
      const saved = this.data.request
        ? await this.requests.update(this.data.request.id, this.payload())
        : await this.requests.create(this.payload());
      this.ref.close(saved);
    } catch {
      this.error.set('Impossibile salvare la richiesta.');
      this.saving.set(false);
    }
  }

  /** Turns the request into an idea (same title, description and area) and links the two. */
  async createIdea(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const idea = await this.ideas.create({
        titolo: this.titolo.trim(),
        descrizione: this.descrizione,
        area: this.area,
        stato: 'idea',
      });
      this.idea = idea.id;
      this.data.ideas.unshift(idea);
      await this.persist();
    } catch {
      this.error.set("Impossibile creare l'idea.");
      this.saving.set(false);
    }
  }

  async remove(): Promise<void> {
    if (!this.data.request || !confirm('Eliminare questa richiesta?')) return;
    await this.requests.remove(this.data.request.id);
    this.ref.close('deleted');
  }
}
