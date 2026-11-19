import { Component, computed, input } from '@angular/core';

export interface Step {
  value: string;
  label: string;
}

/** Row of progress bars with a label under each: the steps up to the current one are filled. */
@Component({
  selector: 'app-steps-bar',
  template: `
    <ol class="md-steps" [attr.aria-label]="label()" [style.grid-template-columns]="'repeat(' + steps().length + ', minmax(0, 1fr))'">
      @for (s of steps(); track s.value; let i = $index) {
        <li [attr.aria-current]="i === index() ? 'step' : null">
          <span class="bar" [class.on]="i <= index()"></span>
          <span class="lbl" [class.done]="i < index()" [class.now]="i === index()">{{ s.label }}</span>
        </li>
      }
    </ol>
  `,
})
export class StepsBar {
  readonly steps = input.required<Step[]>();
  readonly current = input.required<string>();
  readonly label = input('Avanzamento');
  readonly index = computed(() => this.steps().findIndex((s) => s.value === this.current()));
}
