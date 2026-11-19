import { Injectable, inject } from '@angular/core';
import { PocketBaseService } from '../core/pocketbase.service';
import { BadgesService } from './badges.service';
import { WorkRequest } from '../models/models';

@Injectable({ providedIn: 'root' })
export class RequestsService {
  private readonly col = inject(PocketBaseService).client.collection('richieste');
  private readonly badges = inject(BadgesService);

  list(filter = ''): Promise<WorkRequest[]> {
    return this.col.getFullList<WorkRequest>({ sort: '-data,-created', expand: 'area,idea', filter });
  }

  create(data: Partial<WorkRequest>): Promise<WorkRequest> {
    return this.col.create<WorkRequest>(data, { expand: 'area,idea' }).finally(() => void this.badges.refresh());
  }

  update(id: string, data: Partial<WorkRequest>): Promise<WorkRequest> {
    return this.col.update<WorkRequest>(id, data, { expand: 'area,idea' }).finally(() => void this.badges.refresh());
  }

  remove(id: string): Promise<boolean> {
    return this.col.delete(id).finally(() => void this.badges.refresh());
  }
}
