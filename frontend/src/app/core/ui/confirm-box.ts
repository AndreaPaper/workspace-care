import { Component, ElementRef, afterNextRender, inject, input, output, signal } from '@angular/core';

export interface ConfirmChoice {
  id: string;
  title: string;
  meta?: string;
  image?: string;
}

export interface ConfirmOptions {
  /** delete: red box with "Annulla" focused; question: green box; choice: green box with a radio group of cards. */
  kind: 'delete' | 'question' | 'choice';
  /** The question itself: it labels the dialog. */
  title: string;
  text?: string;
  /** "Verranno eliminati anche: …" */
  list?: string[];
  confirmLabel: string;
  cancelLabel?: string;
  choices?: ConfirmChoice[];
}

let nextId = 0;

/**
 * The confirmation drawn "in the panel" (design M2): a coloured box that the ConfirmService inserts next to the
 * element that asked (the detail panel, an inline form…); on a phone it becomes a bottom sheet with a dimmed backdrop.
 */
@Component({
  selector: 'app-confirm-box',
  template: `
    <div class="backdrop" (click)="cancel()"></div>
    <section
      class="box"
      [class.delete]="opts().kind === 'delete'"
      [class.good]="opts().kind !== 'delete'"
      [attr.role]="opts().kind === 'delete' ? 'alertdialog' : 'dialog'"
      [attr.aria-labelledby]="titleId"
      aria-modal="false"
    >
      <span class="handle" aria-hidden="true"></span>
      <h3 [id]="titleId">
        @if (opts().kind === 'delete') {
          <svg class="ico" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2zm-3 6h12l-1 12H7L6 9zm4 2v8h2v-8h-2zm4 0v8h2v-8h-2z" /></svg>
        }
        {{ opts().title }}
      </h3>
      @if (opts().text) { <p class="text">{{ opts().text }}</p> }
      @if (opts().list?.length) {
        <p class="lead">Verranno eliminati anche:</p>
        <ul>@for (l of opts().list; track l) { <li>{{ l }}</li> }</ul>
      }
      @if (opts().choices?.length) {
        <div class="choices" role="radiogroup" [attr.aria-labelledby]="titleId">
          @for (c of opts().choices; track c.id) {
            <label class="card" [class.on]="selected() === c.id">
              <input type="radio" name="choice" [value]="c.id" [checked]="selected() === c.id" (change)="selected.set(c.id)" />
              @if (c.image) { <span class="thumb" [style.background-image]="'url(' + c.image + ')'"></span> } @else { <span class="thumb"></span> }
              <span class="info"><strong>{{ c.title }}</strong>@if (c.meta) { <small>{{ c.meta }}</small> }</span>
            </label>
          }
        </div>
      }
      <div class="btns">
        <button type="button" class="cancel" (click)="cancel()">{{ opts().cancelLabel || 'Annulla' }}</button>
        <button type="button" class="ok" (click)="confirm()">{{ opts().confirmLabel }}</button>
      </div>
    </section>
  `,
  styles: `
    :host { display: block; font-family: Inter, system-ui, sans-serif; }
    .backdrop, .handle { display: none; }
    .box { margin: 12px 0; padding: 16px; border-radius: 18px; border: 1px solid; display: flex; flex-direction: column; gap: 10px; text-align: left; }
    .box.delete { background: #fdecea; border-color: #f6c9c4; color: #5c1a14; }
    .box.good { background: #e9f4ee; border-color: #c8e2d3; color: #173d2b; }
    h3 { margin: 0; display: flex; align-items: center; gap: 8px; font: 800 16px 'Plus Jakarta Sans', Inter, sans-serif; }
    .delete h3 { color: #8e1b12; }
    .good h3 { color: #173d2b; }
    .text, .lead { margin: 0; font-size: 14px; line-height: 1.45; }
    .lead { font-weight: 600; margin-top: 2px; }
    ul { margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.5; }
    .choices { display: flex; flex-direction: column; gap: 8px; }
    .card { display: flex; align-items: center; gap: 12px; padding: 8px; border-radius: 14px; background: #fff; border: 1.5px solid #c8e2d3; cursor: pointer; }
    .card.on { border-color: #2e6a4f; box-shadow: 0 0 0 1px #2e6a4f; }
    .card input { accent-color: #2e6a4f; width: 18px; height: 18px; flex: none; }
    .thumb { width: 52px; height: 52px; flex: none; border-radius: 10px; background: #f1f5f9 center/cover no-repeat; }
    .info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .info strong { font-size: 14px; overflow-wrap: anywhere; }
    .info small { font-size: 12px; color: #5a5c53; }
    .btns { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
    button { height: 44px; padding: 0 18px; border-radius: 999px; font: 700 14px Inter, system-ui, sans-serif; cursor: pointer; }
    .cancel { border: 1px solid #cfc9bb; background: #fff; color: #22241f; }
    .delete .ok { border: 0; background: #b42318; color: #fff; }
    .good .ok { border: 0; background: #2e6a4f; color: #fff; }
    button:focus-visible { outline: 3px solid #2f6fb5; outline-offset: 2px; }
    .card:has(input:focus-visible) { outline: 3px solid #2f6fb5; outline-offset: 2px; }
    @media (max-width: 479px) {
      .backdrop { display: block; position: fixed; inset: 0; z-index: 1000; background: rgba(20, 20, 15, .5); }
      .box { position: fixed; z-index: 1001; left: 0; right: 0; bottom: 0; margin: 0; max-height: 85vh; overflow-y: auto; border-radius: 22px 22px 0 0; border-width: 1px 0 0; padding: 12px 16px 20px; }
      .handle { display: block; width: 40px; height: 5px; border-radius: 999px; background: rgba(0, 0, 0, .25); align-self: center; margin-bottom: 4px; }
      .btns { flex-direction: column-reverse; gap: 8px; }
      button { width: 100%; height: 46px; }
    }
  `,
  host: { '(document:keydown.escape)': 'cancel()' },
})
export class ConfirmBox {
  readonly opts = input.required<ConfirmOptions>();
  readonly result = output<boolean | string | null>();
  readonly selected = signal('');
  readonly titleId = `confirm-title-${nextId++}`;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() => {
      const o = this.opts();
      this.selected.set(o.choices?.[0]?.id ?? '');
      // The safe button has the focus first (Annulla / Non ora); with a choice, the first card.
      queueMicrotask(() => {
        const root = this.host.nativeElement;
        const target = o.kind === 'choice' ? root.querySelector<HTMLElement>('input[type=radio]') : root.querySelector<HTMLElement>('.cancel');
        target?.focus();
        root.querySelector('.box')?.scrollIntoView({ block: 'nearest' });
      });
    });
  }

  cancel(): void {
    this.result.emit(this.opts().kind === 'choice' ? null : false);
  }

  confirm(): void {
    this.result.emit(this.opts().kind === 'choice' ? this.selected() || null : true);
  }
}
