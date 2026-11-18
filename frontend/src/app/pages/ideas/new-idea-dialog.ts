import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Area, Idea } from '../../models/models';
import { IdeaLinksService } from '../../services/idea-links.service';
import { IdeasService } from '../../services/ideas.service';

/** Quick-add dialog. Closes with the created Idea. */
@Component({
  selector: 'app-new-idea-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>Nuova idea</h2>
    <form (ngSubmit)="save()">
      <mat-dialog-content class="form">
        <mat-form-field>
          <mat-label>Titolo</mat-label>
          <input matInput name="titolo" [(ngModel)]="title" required />
        </mat-form-field>
        <mat-form-field>
          <mat-label>Area</mat-label>
          <mat-select name="area" [(ngModel)]="areaId">
            <mat-option value="">(nessuna)</mat-option>
            @for (a of data.areas; track a.id) { <mat-option [value]="a.id">{{ a.nome }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Link (uno per riga, opzionale)</mat-label>
          <textarea matInput name="urls" rows="4" [(ngModel)]="urls"></textarea>
        </mat-form-field>
        @if (error()) { <small class="error">{{ error() }}</small> }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Annulla</button>
        <button mat-flat-button type="submit" [disabled]="!title.trim() || saving()">Crea idea</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .form { display: flex; flex-direction: column; gap: .5rem; padding-top: .5rem !important; }
    .error { color: var(--mat-sys-error); }
  `,
})
export class NewIdeaDialog {
  private readonly ideas = inject(IdeasService);
  private readonly links = inject(IdeaLinksService);
  private readonly ref = inject<MatDialogRef<NewIdeaDialog, Idea>>(MatDialogRef);
  readonly data = inject<{ areas: Area[] }>(MAT_DIALOG_DATA);

  title = '';
  areaId = '';
  urls = '';
  readonly saving = signal(false);
  readonly error = signal('');

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set('');
    try {
      const idea = await this.ideas.create({ titolo: this.title.trim(), area: this.areaId, stato: 'idea' });
      const urls = this.urls.split('\n').map((u) => u.trim()).filter(Boolean);
      // Sequential on purpose: each create triggers the preview download on the server.
      let failed = false;
      for (const url of urls) {
        try {
          await this.links.create(idea.id, url);
        } catch {
          failed = true;
        }
      }
      if (failed) alert("Alcuni link non sono stati aggiunti: aggiungili dal dettaglio dell'idea.");
      this.ref.close(idea);
    } catch {
      this.error.set("Impossibile creare l'idea.");
      this.saving.set(false);
    }
  }
}
