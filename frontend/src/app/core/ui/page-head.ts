import { Component, input } from '@angular/core';

/** Page title with the main action (projected) on the right. */
@Component({
  selector: 'app-page-head',
  template: `
    <header>
      <h1>{{ title() }}</h1>
      <ng-content />
    </header>
  `,
  styles: `
    header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; }
    h1 { margin: 0; font: 800 30px 'Plus Jakarta Sans', Inter, sans-serif; }
    @media (max-width: 800px) { h1 { font-size: 26px; } }
  `,
})
export class PageHead {
  readonly title = input.required<string>();
}
