import { Injectable, inject } from '@angular/core';
import { PocketBaseService } from '../core/pocketbase.service';
import { Idea } from '../models/models';

@Injectable({ providedIn: 'root' })
export class IdeasService {
  private readonly pb = inject(PocketBaseService);
  private readonly col = this.pb.client.collection('idee');

  list(filter = ''): Promise<Idea[]> {
    return this.col.getFullList<Idea>({ sort: '-created', expand: 'area', filter });
  }

  get(id: string): Promise<Idea> {
    return this.col.getOne<Idea>(id, { expand: 'area' });
  }

  create(data: Partial<Idea> | FormData): Promise<Idea> {
    return this.col.create<Idea>(data);
  }

  update(id: string, data: Partial<Idea> | FormData): Promise<Idea> {
    return this.col.update<Idea>(id, data, { expand: 'area' });
  }

  remove(id: string): Promise<boolean> {
    return this.col.delete(id);
  }

  /** Count of ideas per area id, used by the Aree page. */
  async countByArea(): Promise<Record<string, number>> {
    const all = await this.col.getFullList<Idea>({ fields: 'id,area' });
    return all.reduce<Record<string, number>>((acc, i) => {
      acc[i.area] = (acc[i.area] ?? 0) + 1;
      return acc;
    }, {});
  }

  /** First photo, or first link preview image as a fallback. */
  coverUrl(idea: Idea, linkImage?: string): string {
    if (idea.foto?.length) return this.pb.fileUrl(idea, idea.foto[0], '400x300');
    return linkImage ?? '';
  }
}
