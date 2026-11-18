import { Injectable, inject } from '@angular/core';
import { PocketBaseService } from '../core/pocketbase.service';
import { Area } from '../models/models';

@Injectable({ providedIn: 'root' })
export class AreasService {
  private readonly col = inject(PocketBaseService).client.collection('aree');

  list(): Promise<Area[]> {
    return this.col.getFullList<Area>({ sort: 'nome' });
  }

  create(nome: string): Promise<Area> {
    return this.col.create<Area>({ nome });
  }

  rename(id: string, nome: string): Promise<Area> {
    return this.col.update<Area>(id, { nome });
  }

  remove(id: string): Promise<boolean> {
    return this.col.delete(id);
  }
}
