import { Component, input } from '@angular/core';

/** Two cards side by side (stacked on narrow screens): the list on the left, the selected item on the right. */
@Component({
  selector: 'app-master-detail',
  template: `
    <section class="md-list" [attr.aria-label]="listLabel()"><ng-content select="[list]" /></section>
    <section class="md-detail" [attr.aria-label]="detailLabel()"><ng-content select="[detail]" /></section>
  `,
  styles: `
    :host { display: flex; flex-wrap: wrap; gap: 20px; align-items: stretch; }
    section { box-sizing: border-box; background: #fff; border-radius: 24px; display: flex; flex-direction: column; min-width: 0; }
    .md-list { flex: 1 1 340px; padding: 16px; gap: 10px; }
    .md-detail { flex: 999 1 520px; padding: 26px 28px; gap: 20px; }
    @media (max-width: 600px) { .md-detail { padding: 20px 18px; } }
  `,
})
export class MasterDetail {
  readonly listLabel = input('Elenco');
  readonly detailLabel = input('Dettaglio');
}
