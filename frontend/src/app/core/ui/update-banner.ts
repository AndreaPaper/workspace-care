import { Component, inject } from '@angular/core';
import { UpdateService } from '../../services/update.service';

/** Green strip above the pages: a new version is available, being downloaded or ready to install (design M2). */
@Component({
  selector: 'app-update-banner',
  template: `
    @if (update.visible()) {
      @let s = update.state();
      <div class="banner" [class.error]="s.status === 'error'" role="status" aria-live="polite">
        @switch (s.status) {
          @case ('available') {
            <div class="main">
              <span class="msg"><strong>È disponibile la versione {{ s.version }}.</strong> I tuoi dati restano dove sono.</span>
              <span class="actions">
                <button type="button" class="ghost" (click)="update.later()">Più tardi</button>
                <button type="button" class="solid" (click)="update.download()">Aggiorna ora</button>
              </span>
            </div>
            @if (s.notes.length) {
              <ul class="notes" aria-label="Novità">@for (n of s.notes; track n) { <li>{{ n }}</li> }</ul>
            }
          }
          @case ('downloading') {
            <div class="main">
              <span class="msg">Sto scaricando la versione {{ s.version }}… <strong>{{ s.percent }}%</strong></span>
              <progress class="bar" max="100" [value]="s.percent" aria-label="Avanzamento del download"></progress>
            </div>
          }
          @case ('ready') {
            <div class="main">
              <span class="msg"><strong>La versione {{ s.version }} è pronta.</strong> L'app si riavvia in pochi secondi.</span>
              <span class="actions"><button type="button" class="solid" (click)="update.install()">Riavvia e installa</button></span>
            </div>
          }
          @case ('error') {
            <div class="main">
              <span class="msg">{{ s.message }}</span>
              <span class="actions"><button type="button" class="solid" (click)="update.retry()">Riprova</button></span>
            </div>
          }
        }
      </div>
    }
  `,
  styles: `
    .banner { padding: 12px 18px; border-radius: 18px; background: #2e6a4f; color: #fff; font: 14px Inter, system-ui, sans-serif; display: flex; flex-direction: column; gap: 8px; }
    .banner.error { background: #8e1b12; }
    .main { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .actions { display: flex; gap: 8px; }
    .notes { margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.5; opacity: .95; }
    button { height: 40px; padding: 0 16px; border-radius: 999px; font: 700 13px Inter, system-ui, sans-serif; cursor: pointer; }
    .solid { border: 0; background: #fff; color: #173d2b; }
    .ghost { border: 1.5px solid rgba(255, 255, 255, .85); background: transparent; color: #fff; }
    button:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
    .bar { flex: 1; min-width: 120px; max-width: 320px; height: 10px; accent-color: #fff; }
    @media (max-width: 479px) { .actions { width: 100%; } .actions button { flex: 1; } }
  `,
})
export class UpdateBanner {
  readonly update = inject(UpdateService);
}
