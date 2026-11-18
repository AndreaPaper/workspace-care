import { Injectable, inject } from '@angular/core';
import { PocketBaseService } from '../core/pocketbase.service';
import { Rule } from '../models/models';

@Injectable({ providedIn: 'root' })
export class RulesService {
  private readonly col = inject(PocketBaseService).client.collection('regole');

  list(): Promise<Rule[]> {
    return this.col.getFullList<Rule>({ sort: 'tema,created' });
  }

  create(data: Partial<Rule>): Promise<Rule> {
    return this.col.create<Rule>(data);
  }

  update(id: string, data: Partial<Rule>): Promise<Rule> {
    return this.col.update<Rule>(id, data);
  }

  remove(id: string): Promise<boolean> {
    return this.col.delete(id);
  }
}
