import { Injectable, inject } from '@angular/core';
import { PocketBaseService } from '../core/pocketbase.service';
import { IdeaLink } from '../models/models';

@Injectable({ providedIn: 'root' })
export class IdeaLinksService {
  private readonly pb = inject(PocketBaseService);
  private readonly col = this.pb.client.collection('link_idea');

  listByIdea(ideaId: string): Promise<IdeaLink[]> {
    return this.col.getFullList<IdeaLink>({ filter: this.pb.client.filter('idea = {:id}', { id: ideaId }), sort: 'created' });
  }

  listAll(): Promise<IdeaLink[]> {
    return this.col.getFullList<IdeaLink>({ sort: 'created' });
  }

  /** The preview hook runs on create and fills title, site, price and image. */
  create(ideaId: string, url: string): Promise<IdeaLink> {
    return this.col.create<IdeaLink>({ idea: ideaId, url });
  }

  update(id: string, data: Partial<IdeaLink> | FormData): Promise<IdeaLink> {
    return this.col.update<IdeaLink>(id, data);
  }

  remove(id: string): Promise<boolean> {
    return this.col.delete(id);
  }

  imageUrl(link: IdeaLink): string {
    return this.pb.fileUrl(link, link.immagine, '400x300');
  }
}
