import { Signal, effect, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

/** The id kept in the URL (`#/richieste?id=…`): Back works and other pages can link straight to an item. */
export function selectedIdFromUrl(route: ActivatedRoute): Signal<string | null> {
  return toSignal(route.queryParamMap.pipe(map((p) => p.get('id'))), {
    initialValue: route.snapshot.queryParamMap.get('id'),
  });
}

/** Marker id of the "new item" form shown in the detail column. */
export const NEW_ID = 'new';

export function selectItem(router: Router, id: string | null): void {
  // nuova/q are cleared too: they are one-shot parameters (see watchPageParams).
  void router.navigate([], { queryParams: { id, nuova: null, q: null }, queryParamsHandling: 'merge' });
  // On a narrow screen the detail sits below the list: bring it into view.
  if (id && window.innerWidth < 900) {
    setTimeout(() => document.querySelector('.md-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }
}

/**
 * Without an id in the URL a page shows its first item; write that id into the URL (replacing the history entry)
 * so that the selection does not jump to another item when the list is re-sorted. Call it in a constructor.
 */
export function pinFirstSelection(router: Router, selectedId: Signal<string | null>, firstId: Signal<string | undefined>): void {
  effect(() => {
    const first = firstId();
    if (!selectedId() && first) {
      untracked(() => void router.navigate([], { queryParams: { id: first }, queryParamsHandling: 'merge', replaceUrl: true }));
    }
  });
}
