import { Injectable, computed, inject, signal } from '@angular/core';
import { RecordModel } from 'pocketbase';
import { PocketBaseService } from '../core/pocketbase.service';
import { Purchase } from '../models/models';
import { PurchaseTotals, PurchasesService } from './purchases.service';
import { todayDay, toDay } from './dates';

interface SettingsRecord extends RecordModel {
  budget_annuale: number;
  inizio_anno_mese: number;
}

/** How the purchases compare with the annual budget. */
export interface BudgetView {
  annual: number;
  /** Paid since the start of the budget year. */
  spent: number;
  /** Ordered, still to pay. */
  ordered: number;
  /** Estimate (top) of what is still undecided. */
  undecided: number;
  /** What is left of the budget: annual - spent - ordered. Negative when over budget. */
  left: number;
  totals: PurchaseTotals;
  yearStart: string;
}

/** The optional annual budget (and the month the budget year starts), stored in the "impostazioni" collection. */
@Injectable({ providedIn: 'root' })
export class BudgetService {
  private readonly col = inject(PocketBaseService).client.collection('impostazioni');
  private readonly purchases = inject(PurchasesService);
  private record: SettingsRecord | null = null;

  /** Annual budget in euro, or null when not set. */
  readonly annual = signal<number | null>(null);
  /** Month (1-12) the budget year starts. */
  readonly startMonth = signal(1);
  readonly loaded = signal(false);

  /** First day of the budget year that contains today (YYYY-MM-DD). */
  readonly yearStart = computed(() => {
    const today = todayDay();
    const year = Number(today.slice(0, 4));
    const month = Number(today.slice(5, 7));
    const m = this.startMonth();
    return `${month >= m ? year : year - 1}-${String(m).padStart(2, '0')}-01`;
  });

  async load(): Promise<void> {
    try {
      const list = await this.col.getList<SettingsRecord>(1, 1, { sort: 'created' });
      this.record = list.items[0] ?? null;
      this.annual.set(this.record?.budget_annuale ? this.record.budget_annuale : null);
      this.startMonth.set(this.record?.inizio_anno_mese || 1);
    } catch {
      // Without the settings the budget simply stays off.
    } finally {
      this.loaded.set(true);
    }
  }

  async save(annual: number | null, startMonth: number): Promise<void> {
    const data = { budget_annuale: annual && annual > 0 ? annual : 0, inizio_anno_mese: startMonth };
    this.record = this.record ? await this.col.update<SettingsRecord>(this.record.id, data) : await this.col.create<SettingsRecord>(data);
    this.annual.set(data.budget_annuale || null);
    this.startMonth.set(startMonth);
  }

  /** The comparison with the budget, or null when no budget is set. */
  view(purchases: Purchase[]): BudgetView | null {
    const annual = this.annual();
    if (!annual) return null;
    const start = this.yearStart();
    const totals = this.purchases.totals(purchases);
    const spent = purchases
      .filter((p) => p.prezzo_effettivo > 0 && toDay(p.data_acquisto || String(p['created'])) >= start)
      .reduce((sum, p) => sum + p.prezzo_effettivo, 0);
    return { annual, spent, ordered: totals.ordered, undecided: totals.undecidedMax, left: annual - spent - totals.ordered, totals, yearStart: start };
  }
}
