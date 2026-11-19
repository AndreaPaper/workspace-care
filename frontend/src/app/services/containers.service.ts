import { Injectable, inject } from '@angular/core';
import { PocketBaseService } from '../core/pocketbase.service';
import { Container } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ContainersService {
  private readonly col = inject(PocketBaseService).client.collection('contenitori');

  list(): Promise<Container[]> {
    return this.col.getFullList<Container>({ sort: 'nome' });
  }

  create(data: Partial<Container>): Promise<Container> {
    return this.col.create<Container>(data);
  }

  update(id: string, data: Partial<Container>): Promise<Container> {
    return this.col.update<Container>(id, data);
  }

  /** The items inside keep existing: their link to the container is emptied by the server. */
  remove(id: string): Promise<boolean> {
    return this.col.delete(id);
  }
}
