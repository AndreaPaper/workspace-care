import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { PocketBaseService } from '../../core/pocketbase.service';
import { Areas } from '../areas/areas';
import { Drawers } from '../drawers/drawers';
import { Inventory } from '../inventory/inventory';

type OfficeTab = 'inventario' | 'cassettiere' | 'aree';

const TABS: { key: OfficeTab; label: string; collection: string }[] = [
  { key: 'inventario', label: 'Inventario', collection: 'inventario' },
  { key: 'cassettiere', label: 'Cassettiere', collection: 'cassettiere' },
  { key: 'aree', label: 'Aree', collection: 'aree' },
];

/** Inventario, Cassettiere and Aree as three tabs of one page. The tab lives in the URL (`#/ufficio?tab=cassettiere`). */
@Component({
  selector: 'app-office',
  imports: [Inventory, Drawers, Areas],
  template: `
    <h1>Ufficio</h1>

    <div role="tablist" aria-label="Sezioni dell'ufficio" class="tabs">
      @for (t of tabs; track t.key) {
        <button type="button" role="tab" [attr.aria-selected]="tab() === t.key" (click)="go(t.key)">
          {{ t.label }} <span class="n">{{ counts()[t.key] }}</span>
        </button>
      }
    </div>

    @switch (tab()) {
      @case ('inventario') { <app-inventory (changed)="refresh()" /> }
      @case ('cassettiere') { <app-drawers (changed)="refresh()" /> }
      @case ('aree') { <app-areas (changed)="refresh()" /> }
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 22px; }
    h1 { margin: 0; font: 800 30px 'Plus Jakarta Sans', Inter, sans-serif; }
    .tabs { display: flex; flex-wrap: wrap; gap: 4px; border-bottom: 1px solid #e6e0d3; }
    .tabs button { height: 44px; padding: 0 16px; border: 0; border-bottom: 3px solid transparent; background: transparent; color: #45473f; font: 600 14px Inter, system-ui, sans-serif; cursor: pointer; }
    .tabs button[aria-selected='true'] { border-bottom-color: #2e6a4f; color: #173d2b; font-weight: 700; }
    .tabs button:focus-visible { outline: 3px solid #2f6fb5; outline-offset: -3px; }
    .n { margin-left: 4px; padding: 2px 8px; border-radius: 999px; background: #efebe3; font-size: 12px; }
    [aria-selected='true'] .n { background: #e3eee7; }
    @media (max-width: 800px) { h1 { font-size: 26px; } }
  `,
})
export class Office implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pb = inject(PocketBaseService);

  readonly tabs = TABS;
  readonly counts = signal<Record<OfficeTab, number>>({ inventario: 0, cassettiere: 0, aree: 0 });

  readonly tab = computed<OfficeTab>(() => {
    const t = this.requested();
    return TABS.some((x) => x.key === t) ? (t as OfficeTab) : 'inventario';
  });
  private readonly requested = toSignal(this.route.queryParamMap.pipe(map((p) => p.get('tab'))), {
    initialValue: this.route.snapshot.queryParamMap.get('tab'),
  });

  ngOnInit(): void {
    void this.refresh();
  }

  go(tab: OfficeTab): void {
    void this.router.navigate([], { queryParams: { tab, q: null, nuova: null }, queryParamsHandling: 'merge' });
  }

  async refresh(): Promise<void> {
    try {
      const totals = await Promise.all(
        TABS.map((t) => this.pb.client.collection(t.collection).getList(1, 1, { fields: 'id' }).then((r) => r.totalItems)),
      );
      this.counts.set({ inventario: totals[0], cassettiere: totals[1], aree: totals[2] });
    } catch {
      // Counters are a convenience.
    }
  }
}
