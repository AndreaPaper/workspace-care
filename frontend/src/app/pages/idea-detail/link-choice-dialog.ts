import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatRadioModule } from '@angular/material/radio';
import { IdeaLink } from '../../models/models';

/** Lets the user pick which link feeds supplier and URL of the new purchase. Closes with the link id. */
@Component({
  selector: 'app-link-choice-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatRadioModule],
  template: `
    <h2 mat-dialog-title>Quale link usare per l'acquisto?</h2>
    <mat-dialog-content>
      <mat-radio-group [(ngModel)]="selected" class="list">
        @for (l of data.links; track l.id) {
          <mat-radio-button [value]="l.id">
            {{ l.titolo || l.url }} <small class="muted">{{ l.sito }} {{ l.prezzo }}</small>
          </mat-radio-button>
        }
      </mat-radio-group>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Annulla</button>
      <button mat-flat-button [mat-dialog-close]="selected">Converti</button>
    </mat-dialog-actions>
  `,
  styles: `.list { display: flex; flex-direction: column; }`,
})
export class LinkChoiceDialog {
  readonly data = inject<{ links: IdeaLink[] }>(MAT_DIALOG_DATA);
  selected = this.data.links[0]?.id ?? '';
}
