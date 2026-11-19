import { Injectable, inject } from '@angular/core';
import { PocketBaseService } from '../core/pocketbase.service';
import { todayDay, toDay } from './dates';

/** What is linked to one area. */
export interface AreaStats {
  items: number;
  containers: number;
  units: number;
  checks: number;
  checksLate: number;
  ideasOpen: number;
  requestsOpen: number;
  rules: number;
  /** Everything linked to the area, ideas and purchases of any state included: zero means the area can be deleted. */
  links: number;
}

const OPEN_REQUESTS = ['ricevuta', 'in_valutazione', 'in_corso'];
const CLOSED_IDEAS = ['fatta', 'scartata'];

@Injectable({ providedIn: 'root' })
export class AreaOverviewService {
  private readonly c = inject(PocketBaseService).client;

  /** Counts per area id (the key '' is not used: items without area are not part of any area). */
  async load(): Promise<Record<string, AreaStats>> {
    const all = <T>(name: string, fields: string) => this.c.collection(name).getFullList<T>({ fields });
    const [ideas, requests, purchases, checks, items, containers, units, rules] = await Promise.all([
      all<{ area: string; stato: string }>('idee', 'area,stato'),
      all<{ area: string; stato: string }>('richieste', 'area,stato'),
      all<{ area: string }>('acquisti', 'area'),
      all<{ area: string; prossima_scadenza: string }>('controlli', 'area,prossima_scadenza'),
      all<{ area: string }>('inventario', 'area'),
      all<{ area: string }>('contenitori', 'area'),
      all<{ area: string }>('cassettiere', 'area'),
      all<{ area: string }>('regole', 'area'),
    ]);
    const stats: Record<string, AreaStats> = {};
    const of = (id: string): AreaStats | null => {
      if (!id) return null;
      return (stats[id] ??= { items: 0, containers: 0, units: 0, checks: 0, checksLate: 0, ideasOpen: 0, requestsOpen: 0, rules: 0, links: 0 });
    };
    const today = todayDay();
    for (const i of ideas) { const s = of(i.area); if (s) { s.links++; if (!CLOSED_IDEAS.includes(i.stato)) s.ideasOpen++; } }
    for (const r of requests) { const s = of(r.area); if (s) { s.links++; if (OPEN_REQUESTS.includes(r.stato)) s.requestsOpen++; } }
    for (const p of purchases) { const s = of(p.area); if (s) s.links++; }
    for (const k of checks) { const s = of(k.area); if (s) { s.links++; s.checks++; if (k.prossima_scadenza && toDay(k.prossima_scadenza) < today) s.checksLate++; } }
    for (const i of items) { const s = of(i.area); if (s) { s.links++; s.items++; } }
    for (const k of containers) { const s = of(k.area); if (s) { s.links++; s.containers++; } }
    for (const u of units) { const s = of(u.area); if (s) { s.links++; s.units++; } }
    for (const r of rules) { const s = of(r.area); if (s) { s.links++; s.rules++; } }
    return stats;
  }
}
