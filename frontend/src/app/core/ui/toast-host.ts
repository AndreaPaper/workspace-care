import { Component, inject } from '@angular/core';
import { ToastService } from '../../services/toast.service';

/** Shows the ToastService messages at the bottom centre of the page. */
@Component({
  selector: 'app-toast-host',
  template: `
    <div class="host">
      @for (t of toasts.toasts(); track t.id) {
        <div class="toast" [class.error]="t.kind === 'error'" [attr.role]="t.kind === 'error' ? 'alert' : 'status'">
          <span class="ico" aria-hidden="true">{{ t.kind === 'error' ? '!' : '✓' }}</span>
          <span class="body">
            <strong>{{ t.title }}</strong>
            @if (t.text) { <small>{{ t.text }}</small> }
          </span>
          @for (a of t.actions; track a.label) {
            <button type="button" class="act" (click)="a.run(); toasts.dismiss(t.id)">{{ a.label }}</button>
          }
          <button type="button" class="x" (click)="toasts.dismiss(t.id)" aria-label="Chiudi il messaggio">×</button>
        </div>
      }
    </div>
  `,
  styles: `
    .host { position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); z-index: 1100; display: flex; flex-direction: column; gap: 8px; width: min(560px, calc(100vw - 24px)); pointer-events: none; font-family: Inter, system-ui, sans-serif; }
    .toast { pointer-events: auto; display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 16px; background: #1f4d38; color: #fff; box-shadow: 0 8px 28px rgba(20, 30, 20, .3); }
    .toast.error { background: #fff; color: #5c1a14; border: 1px solid #f6c9c4; }
    .ico { flex: none; width: 24px; height: 24px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; background: rgba(255, 255, 255, .2); }
    .error .ico { background: #b42318; color: #fff; }
    .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; font-size: 14px; }
    .body small { font-size: 12px; opacity: .85; overflow-wrap: anywhere; }
    button { font: inherit; cursor: pointer; }
    .act { flex: none; height: 36px; padding: 0 14px; border-radius: 999px; border: 1px solid rgba(255, 255, 255, .6); background: transparent; color: inherit; font-weight: 700; font-size: 13px; }
    .error .act { border-color: #cfc9bb; color: #22241f; background: #fff; }
    .x { flex: none; width: 32px; height: 32px; border: 0; background: transparent; color: inherit; font-size: 22px; line-height: 1; border-radius: 999px; }
    button:focus-visible { outline: 3px solid #2f6fb5; outline-offset: 2px; }
    @media (max-width: 479px) { .host { bottom: 12px; } .toast { flex-wrap: wrap; } }
  `,
})
export class ToastHost {
  readonly toasts = inject(ToastService);
}
