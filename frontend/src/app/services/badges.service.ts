import { Injectable, inject, signal } from '@angular/core';
import { PocketBaseService } from '../core/pocketbase.service';
import { todayDay } from './dates';

/** Counters shown on the sidebar: open requests and checks that need attention. */
@Injectable({ providedIn: 'root' })
export class BadgesService {
  private readonly pb = inject(PocketBaseService);

  readonly openRequests = signal(0);
  /** Checks whose due date is before today. */
  readonly checksLate = signal(0);
  /** Checks due today. */
  readonly checksToday = signal(0);

  async refresh(): Promise<void> {
    if (!this.pb.isLoggedIn()) return;
    const c = this.pb.client;
    const today = todayDay();
    try {
      const [open, late, due] = await Promise.all([
        c.collection('richieste').getList(1, 1, {
          filter: 'stato = "ricevuta" || stato = "in_valutazione" || stato = "in_corso"',
          fields: 'id',
        }),
        c.collection('controlli').getList(1, 1, {
          filter: c.filter('prossima_scadenza < {:d}', { d: `${today} 00:00:00.000Z` }),
          fields: 'id',
        }),
        c.collection('controlli').getList(1, 1, {
          filter: c.filter('prossima_scadenza >= {:a} && prossima_scadenza <= {:b}', {
            a: `${today} 00:00:00.000Z`,
            b: `${today} 23:59:59.999Z`,
          }),
          fields: 'id',
        }),
      ]);
      this.openRequests.set(open.totalItems);
      this.checksLate.set(late.totalItems);
      this.checksToday.set(due.totalItems);
    } catch {
      // Counters are a convenience: never break navigation because of them.
    }
  }
}
