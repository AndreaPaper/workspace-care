import { Injectable, inject } from '@angular/core';
import { PocketBaseService } from '../core/pocketbase.service';
import { BadgesService } from './badges.service';
import { Check, CheckOutcome, CheckRun } from '../models/models';
import { addDays, todayDay, toDay } from './dates';

export type CheckBucket = 'scaduti' | 'oggi' | 'settimana' | 'dopo';

@Injectable({ providedIn: 'root' })
export class ControlsService {
  private readonly pb = inject(PocketBaseService);
  private readonly badges = inject(BadgesService);
  private readonly col = this.pb.client.collection('controlli');
  private readonly runs = this.pb.client.collection('esecuzioni_controllo');

  list(): Promise<Check[]> {
    return this.col.getFullList<Check>({ sort: 'prossima_scadenza,nome', expand: 'area' });
  }

  create(data: Partial<Check>): Promise<Check> {
    return this.col.create<Check>(data, { expand: 'area' }).finally(() => void this.badges.refresh());
  }

  update(id: string, data: Partial<Check>): Promise<Check> {
    return this.col.update<Check>(id, data, { expand: 'area' }).finally(() => void this.badges.refresh());
  }

  remove(id: string): Promise<boolean> {
    return this.col.delete(id).finally(() => void this.badges.refresh());
  }

  /** Server-side: records the execution and moves the due date forward. */
  markDone(id: string, esito: CheckOutcome = 'ok', note = ''): Promise<Check> {
    return this.pb.client
      .send<Check>(`/api/controlli/${id}/fatto`, { method: 'POST', body: { esito, note } })
      .finally(() => void this.badges.refresh());
  }

  /** Day of the latest execution of every check, by check id. */
  async lastRuns(): Promise<Record<string, string>> {
    const runs = await this.runs.getFullList<CheckRun>({ sort: '-data,-created', fields: 'controllo,data' });
    const last: Record<string, string> = {};
    for (const r of runs) if (!last[r.controllo]) last[r.controllo] = toDay(r.data);
    return last;
  }

  history(id: string, limit = 5): Promise<CheckRun[]> {
    return this.runs
      .getList<CheckRun>(1, limit, {
        filter: this.pb.client.filter('controllo = {:id}', { id }),
        sort: '-data,-created',
      })
      .then((r) => r.items);
  }

  /** All executions on or after `sinceDay` (YYYY-MM-DD), newest first, with the check expanded. */
  runsSince(sinceDay?: string): Promise<(CheckRun & { expand?: { controllo?: Check } })[]> {
    const filter = sinceDay ? this.pb.client.filter('data >= {:d}', { d: sinceDay + ' 00:00:00.000Z' }) : '';
    return this.runs.getFullList({ sort: '-data,-created', expand: 'controllo', filter });
  }

  bucket(check: Check): CheckBucket {
    const due = toDay(check.prossima_scadenza);
    const today = todayDay();
    if (due < today) return 'scaduti';
    if (due === today) return 'oggi';
    return due <= addDays(today, 7) ? 'settimana' : 'dopo';
  }
}
