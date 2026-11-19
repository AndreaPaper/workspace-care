import { Injectable, inject } from '@angular/core';
import { PocketBaseService } from '../core/pocketbase.service';
import { Drawer, DrawerUnit } from '../models/models';

/** Drawer units ("cassettiere"). Deleting a unit deletes its drawers (cascade on the server). */
@Injectable({ providedIn: 'root' })
export class DrawerUnitsService {
  private readonly col = inject(PocketBaseService).client.collection('cassettiere');

  list(): Promise<DrawerUnit[]> {
    return this.col.getFullList<DrawerUnit>({ sort: 'numero', expand: 'area' });
  }

  create(data: Partial<DrawerUnit>): Promise<DrawerUnit> {
    return this.col.create<DrawerUnit>(data, { expand: 'area' });
  }

  update(id: string, data: Partial<DrawerUnit>): Promise<DrawerUnit> {
    return this.col.update<DrawerUnit>(id, data, { expand: 'area' });
  }

  remove(id: string): Promise<boolean> {
    return this.col.delete(id);
  }

  /** Creates the units numbered up to `upTo` that do not exist yet, each with `drawers` free drawers. */
  async createUpTo(upTo: number, drawers: number, existing: DrawerUnit[], drawersService: DrawersService): Promise<void> {
    const taken = new Set(existing.map((u) => u.numero));
    for (let n = 1; n <= upTo; n++) {
      if (taken.has(n)) continue;
      const unit = await this.col.create<DrawerUnit>({ numero: n });
      await drawersService.createFree(unit.id, 1, drawers);
    }
  }
}

/** Single drawers ("cassetti"). */
@Injectable({ providedIn: 'root' })
export class DrawersService {
  private readonly col = inject(PocketBaseService).client.collection('cassetti');

  list(): Promise<Drawer[]> {
    return this.col.getFullList<Drawer>({ sort: 'cassettiera,numero' });
  }

  update(id: string, data: Partial<Drawer>): Promise<Drawer> {
    return this.col.update<Drawer>(id, data);
  }

  remove(id: string): Promise<boolean> {
    return this.col.delete(id);
  }

  /** Adds free drawers numbered from `from` to `from + count - 1`. */
  async createFree(unitId: string, from: number, count: number): Promise<void> {
    for (let n = from; n < from + count; n++) {
      await this.col.create({ cassettiera: unitId, numero: n, tipo: 'libero' });
    }
  }
}
