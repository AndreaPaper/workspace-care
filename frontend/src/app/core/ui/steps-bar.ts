import { Component, computed, input, output } from '@angular/core';

export interface Step {
  value: string;
  label: string;
}

/**
 * Row of progress bars with a label under each: the steps up to the current one are filled.
 * With `selectable` every step is a button and picking one emits `choose` (change the state without opening the form).
 */
@Component({
  selector: 'app-steps-bar',
  template: `
    <ol class="md-steps" [class.pick]="selectable()" [attr.aria-label]="label()" [style.grid-template-columns]="'repeat(' + steps().length + ', minmax(0, 1fr))'">
      @for (s of steps(); track s.value; let i = $index) {
        <li [attr.aria-current]="i === index() ? 'step' : null">
          @if (selectable()) {
            <button type="button" class="step" [attr.aria-pressed]="i === index()" [attr.title]="i === index() ? null : 'Segna come: ' + s.label" (click)="choose.emit(s.value)">
              <span class="bar" [class.on]="i <= index()"></span>
              <span class="lbl" [class.done]="i < index()" [class.now]="i === index()">{{ s.label }}</span>
            </button>
          } @else {
            <span class="bar" [class.on]="i <= index()"></span>
            <span class="lbl" [class.done]="i < index()" [class.now]="i === index()">{{ s.label }}</span>
          }
        </li>
      }
    </ol>
  `,
})
export class StepsBar {
  readonly steps = input.required<Step[]>();
  readonly current = input.required<string>();
  readonly label = input('Avanzamento');
  /** Makes the steps clickable. */
  readonly selectable = input(false);
  readonly choose = output<string>();
  readonly index = computed(() => this.steps().findIndex((s) => s.value === this.current()));
}
