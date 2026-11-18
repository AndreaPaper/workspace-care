import { Injectable, inject } from '@angular/core';
import { PocketBaseService } from '../core/pocketbase.service';
import { InventoryItem } from '../models/models';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly col = inject(PocketBaseService).client.collection('inventario');

  list(): Promise<InventoryItem[]> {
    return this.col.getFullList<InventoryItem>({ sort: 'nome', expand: 'area' });
  }

  create(data: Partial<InventoryItem>): Promise<InventoryItem> {
    return this.col.create<InventoryItem>(data, { expand: 'area' });
  }

  update(id: string, data: Partial<InventoryItem>): Promise<InventoryItem> {
    return this.col.update<InventoryItem>(id, data, { expand: 'area' });
  }

  remove(id: string): Promise<boolean> {
    return this.col.delete(id);
  }
}
