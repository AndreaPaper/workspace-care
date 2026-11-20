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

  /** Cropped thumbnail (cover of a list item). */
  imageUrl(link: IdeaLink): string {
    return this.pb.fileUrl(link, link.immagine, '400x300');
  }

  /** The whole picture, 480 px wide: for the link cards, where a screenshot must not be cropped. */
  imageFitUrl(link: IdeaLink): string {
    return this.pb.fileUrl(link, link.immagine, '480x0');
  }

  /** Server-side: fetches the page again and fills title, price and image (the existing image is kept if none is found). */
  retryPreview(id: string): Promise<IdeaLink> {
    return this.pb.client.send<IdeaLink>(`/api/link_idea/${id}/anteprima`, { method: 'POST' });
  }
}
