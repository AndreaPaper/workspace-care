import { Injectable, inject } from '@angular/core';
import { PocketBaseService } from '../core/pocketbase.service';
import { WorkRequest } from '../models/models';

@Injectable({ providedIn: 'root' })
export class RequestsService {
  private readonly col = inject(PocketBaseService).client.collection('richieste');

  list(filter = ''): Promise<WorkRequest[]> {
    return this.col.getFullList<WorkRequest>({ sort: '-data,-created', expand: 'area,idea', filter });
  }

  create(data: Partial<WorkRequest>): Promise<WorkRequest> {
    return this.col.create<WorkRequest>(data, { expand: 'area,idea' });
  }

  update(id: string, data: Partial<WorkRequest>): Promise<WorkRequest> {
    return this.col.update<WorkRequest>(id, data, { expand: 'area,idea' });
  }

  remove(id: string): Promise<boolean> {
    return this.col.delete(id);
  }
}
