import { Injectable, inject } from '@angular/core';
import { PocketBaseService } from '../core/pocketbase.service';
import { RequestEvent } from '../models/models';

@Injectable({ providedIn: 'root' })
export class RequestEventsService {
  private readonly pb = inject(PocketBaseService);
  private readonly col = this.pb.client.collection('eventi_richiesta');

  /** History of one request, newest first. */
  list(requestId: string): Promise<RequestEvent[]> {
    return this.col.getFullList<RequestEvent>({
      filter: this.pb.client.filter('richiesta = {:id}', { id: requestId }),
      sort: '-data,-created',
    });
  }

  addNote(requestId: string, text: string): Promise<RequestEvent> {
    return this.col.create<RequestEvent>({
      richiesta: requestId,
      tipo: 'nota',
      testo: text,
      data: new Date().toISOString().replace('T', ' '),
    });
  }
}
