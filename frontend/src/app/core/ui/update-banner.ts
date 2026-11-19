import { Component, inject } from '@angular/core';
import { UpdateService } from '../../services/update.service';

/** Strip shown above the pages when a new version is available, being downloaded or ready to install. */
@Component({
  selector: 'app-update-banner',
  template: `
    @if (update.visible()) {
      @let s = update.state();
      <div class="banner" role="status" aria-live="polite">
        @switch (s.status) {
          @case ('available') {
            <span><strong>È disponibile la versione {{ s.version }}.</strong> I tuoi dati restano dove sono.</span>
            <span class="actions">
              <button type="button" class="primary" (click)="update.download()">Aggiorna ora</button>
              <button type="button" class="ghost" (click)="update.later()">Più tardi</button>
            </span>
          }
          @case ('downloading') {
            <span>Sto scaricando la versione {{ s.version }}… {{ s.percent }}%</span>
            <progress class="bar" max="100" [value]="s.percent" aria-label="Avanzamento del download"></progress>
          }
          @case ('ready') {
            <span><strong>La versione {{ s.version }} è pronta.</strong> L'app si riavvia in pochi secondi.</span>
            <span class="actions"><button type="button" class="primary" (click)="update.install()">Riavvia e installa</button></span>
          }
          @case ('error') {
            <span>{{ s.message }}</span>
            <span class="actions"><button type="button" class="ghost" (click)="update.retry()">Riprova</button></span>
          }
        }
      </div>
    }
  `,
  styles: `
    .banner { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 10px 16px; border-radius: 16px; background: #edf5f0; border: 1px solid #a9cdb8; color: #173d2b; font: 14px Inter, system-ui, sans-serif; }
    .actions { display: flex; gap: 8px; }
    button { height: 40px; padding: 0 16px; border-radius: 999px; font: 700 13px Inter, system-ui, sans-serif; cursor: pointer; }
    .primary { border: 0; background: #2e6a4f; color: #fff; }
    .ghost { border: 1px solid #6fa88a; background: #fff; color: #173d2b; }
    button:focus-visible { outline: 3px solid #2f6fb5; outline-offset: 2px; }
    .bar { flex: 1; min-width: 120px; max-width: 320px; height: 10px; accent-color: #2e6a4f; }
  `,
})
export class UpdateBanner {
  readonly update = inject(UpdateService);
}
