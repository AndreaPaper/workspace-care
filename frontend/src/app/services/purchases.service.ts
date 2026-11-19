import { Injectable, inject } from '@angular/core';
import { PocketBaseService } from '../core/pocketbase.service';
import { Idea, Purchase } from '../models/models';

export interface PurchaseTotals {
  estimateMin: number;
  estimateMax: number;
  /** Sum of actual prices already paid. */
  spent: number;
  /** Still to spend: estimate (max, or min if no max) of rows without an actual price. */
  remaining: number;
  /** Rows not yet ordered. */
  toOrder: number;
  /** Paid and received: price of the rows that are arrivato or montato. */
  received: number;
  /** Ordered, still to pay or arrive: price (or the top estimate) of the rows that are ordinato. */
  ordered: number;
  /** Not decided yet: estimate range of the rows that are da_proporre or approvato. */
  undecidedMin: number;
  undecidedMax: number;
}

@Injectable({ providedIn: 'root' })
export class PurchasesService {
  private readonly pb = inject(PocketBaseService);
  private readonly col = this.pb.client.collection('acquisti');

  list(filter = ''): Promise<Purchase[]> {
    return this.col.getFullList<Purchase>({ sort: '-created', expand: 'area,idea', filter });
  }

  create(data: Partial<Purchase>): Promise<Purchase> {
    return this.col.create<Purchase>(data, { expand: 'area,idea' });
  }

  update(id: string, data: Partial<Purchase>): Promise<Purchase> {
    return this.col.update<Purchase>(id, data, { expand: 'area,idea' });
  }

  remove(id: string): Promise<boolean> {
    return this.col.delete(id);
  }

  byIdea(ideaId: string): Promise<Purchase[]> {
    return this.list(this.pb.client.filter('idea = {:id}', { id: ideaId }));
  }

  /** Server-side: creates the purchase from the idea, or returns the existing one. */
  convert(ideaId: string, linkId?: string): Promise<{ acquisto: Purchase; esistente: boolean; idea: Idea }> {
    return this.pb.client.send(`/api/idee/${ideaId}/converti`, {
      method: 'POST',
      body: linkId ? { link_id: linkId } : {},
    });
  }

  totals(purchases: Purchase[]): PurchaseTotals {
    const t: PurchaseTotals = {
      estimateMin: 0, estimateMax: 0, spent: 0, remaining: 0, toOrder: 0,
      received: 0, ordered: 0, undecidedMin: 0, undecidedMax: 0,
    };
    for (const p of purchases) {
      const min = p.stima_min || 0;
      const max = p.stima_max || min;
      t.estimateMin += min;
      t.estimateMax += max;
      if (p.prezzo_effettivo) t.spent += p.prezzo_effettivo;
      else t.remaining += max;
      if (p.stato === 'da_proporre' || p.stato === 'approvato') {
        t.toOrder++;
        t.undecidedMin += min;
        t.undecidedMax += max;
      } else if (p.stato === 'ordinato') {
        t.ordered += p.prezzo_effettivo || max;
      } else {
        t.received += p.prezzo_effettivo || 0;
      }
    }
    return t;
  }
}
