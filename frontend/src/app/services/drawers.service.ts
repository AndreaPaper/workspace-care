import { Injectable, inject } from '@angular/core';
import { PocketBaseService } from '../core/pocketbase.service';
import { Drawer } from '../models/models';

@Injectable({ providedIn: 'root' })
export class DrawersService {
  private readonly col = inject(PocketBaseService).client.collection('cassettiere');

  list(): Promise<Drawer[]> {
    return this.col.getFullList<Drawer>({ sort: 'numero', expand: 'area' });
  }

  create(data: Partial<Drawer>): Promise<Drawer> {
    return this.col.create<Drawer>(data, { expand: 'area' });
  }

  update(id: string, data: Partial<Drawer>): Promise<Drawer> {
    return this.col.update<Drawer>(id, data, { expand: 'area' });
  }

  remove(id: string): Promise<boolean> {
    return this.col.delete(id);
  }

  /** Creates drawers numbered from the next free number up to `upTo`, all personal and unassigned. */
  async createUpTo(upTo: number, existing: Drawer[]): Promise<void> {
    const taken = new Set(existing.map((d) => d.numero));
    for (let n = 1; n <= upTo; n++) {
      if (!taken.has(n)) await this.col.create({ numero: n, tipo: 'personale' });
    }
  }
}
