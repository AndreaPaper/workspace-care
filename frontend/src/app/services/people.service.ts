import { Injectable, inject, signal } from '@angular/core';
import { RecordModel } from 'pocketbase';
import { PocketBaseService } from '../core/pocketbase.service';

export interface Person extends RecordModel {
  nome: string;
}

/** The colleagues' names suggested in the drawer and request forms (the fields stay free text). */
@Injectable({ providedIn: 'root' })
export class PeopleService {
  private readonly col = inject(PocketBaseService).client.collection('persone');
  readonly people = signal<Person[]>([]);

  async load(): Promise<void> {
    try {
      this.people.set(await this.col.getFullList<Person>({ sort: 'nome' }));
    } catch {
      // Suggestions are a convenience.
    }
  }

  async create(nome: string): Promise<void> {
    await this.col.create({ nome: nome.trim() });
    await this.load();
  }

  async rename(id: string, nome: string): Promise<void> {
    await this.col.update(id, { nome: nome.trim() });
    await this.load();
  }

  async remove(id: string): Promise<void> {
    await this.col.delete(id);
    await this.load();
  }
}
