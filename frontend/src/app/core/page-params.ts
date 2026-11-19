import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

/**
 * Lets other parts of the app drive a page through its query string:
 * `?nuova=1` opens the "new" dialog (sidebar "Nuovo" menu, dashboard shortcuts) and
 * `&area=<id>` pre-selects the area of the new item, and `?q=text` pre-fills the page's search (global search results).
 * Call it once the page has loaded its data. Both parameters are removed after use, so a reload
 * or a back navigation does not repeat them.
 */
export function watchPageParams(
  route: ActivatedRoute,
  router: Router,
  destroyRef: DestroyRef,
  handlers: { onNew?: (area?: string) => void; onSearch?: (q: string) => void },
): void {
  route.queryParamMap.pipe(takeUntilDestroyed(destroyRef)).subscribe((params) => {
    const wantsNew = params.has('nuova');
    const q = params.get('q');
    const area = params.get('area') ?? undefined;
    if (!wantsNew && q === null) return;
    void router.navigate([], { queryParams: { nuova: null, q: null, area: null }, queryParamsHandling: 'merge', replaceUrl: true });
    if (q !== null) handlers.onSearch?.(q);
    if (wantsNew) handlers.onNew?.(area);
  });
}
