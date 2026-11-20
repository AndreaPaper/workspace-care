import { Injectable, inject } from '@angular/core';
import { PocketBaseService } from '../core/pocketbase.service';

export interface SearchHit {
  type: 'Idee' | 'Richieste' | 'Acquisti' | 'Inventario' | 'Cassettiere' | 'Regole';
  icon: string;
  title: string;
  detail: string;
  /** Router link; the search text is passed on as ?q= to the list pages. */
  link: string[];
  withQuery: boolean;
  /** Extra query parameters, e.g. the id of the item to select. */
  params?: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly c = inject(PocketBaseService).client;

  async search(q: string): Promise<SearchHit[]> {
    const f = (expr: string) => this.c.filter(expr, { q });
    const opts = (filter: string, sort = '-updated') => ({ filter, sort, expand: 'area' });
    const [ideas, requests, purchases, items, drawers, rules] = await Promise.all([
      this.c.collection('idee').getList(1, 5, opts(f('titolo ~ {:q} || descrizione ~ {:q}'))),
      this.c.collection('richieste').getList(1, 4, opts(f('titolo ~ {:q} || richiedente ~ {:q}'))),
      this.c.collection('acquisti').getList(1, 4, opts(f('articolo ~ {:q} || fornitore ~ {:q}'))),
      this.c.collection('inventario').getList(1, 4, opts(f('nome ~ {:q} || posizione ~ {:q} || note ~ {:q}'))),
      this.c.collection('cassetti').getList(1, 4, { filter: f('assegnato_a ~ {:q} || contenuto ~ {:q}' + (/roba/i.test(q) ? ' || tipo = "con_roba"' : '')), sort: 'cassettiera,numero', expand: 'cassettiera.area' }),
      this.c.collection('regole').getList(1, 4, opts(f('testo ~ {:q}'))),
    ]);
    const area = (r: { expand?: { area?: { nome?: string } } }) => r.expand?.area?.nome ?? '';
    return [
      ...ideas.items.map((r): SearchHit => ({ type: 'Idee', icon: 'lightbulb', title: r['titolo'], detail: area(r), link: ['/idee'], withQuery: false, params: { id: r.id } })),
      ...requests.items.map((r): SearchHit => ({ type: 'Richieste', icon: 'inbox', title: r['titolo'], detail: r['richiedente'] || area(r), link: ['/richieste'], withQuery: false, params: { id: r.id } })),
      ...purchases.items.map((r): SearchHit => ({ type: 'Acquisti', icon: 'shopping_cart', title: r['articolo'], detail: r['fornitore'] || area(r), link: ['/acquisti'], withQuery: false, params: { id: r.id } })),
      ...items.items.map((r): SearchHit => ({ type: 'Inventario', icon: 'inventory_2', title: r['nome'], detail: r['posizione'] || area(r), link: ['/ufficio'], withQuery: false, params: { tab: 'inventario', q } })),
      ...drawers.items.map((r): SearchHit => {
        const unit = r.expand?.['cassettiera'] as { numero?: number; expand?: { area?: { nome?: string } } } | undefined;
        const where = [`Cassettiera ${unit?.numero ?? ''}`, `cassetto ${r['numero']}`, unit?.expand?.area?.nome].filter(Boolean).join(' · ');
        return { type: 'Cassettiere', icon: 'table_rows', title: r['assegnato_a'] || r['contenuto'] || (r['tipo'] === 'con_roba' ? 'Con roba' : ''), detail: where, link: ['/ufficio'], withQuery: false, params: { tab: 'cassettiere', cassetto: r.id } };
      }),
      ...rules.items.map((r): SearchHit => ({ type: 'Regole', icon: 'menu_book', title: String(r['testo']).slice(0, 70), detail: r['tema'], link: ['/regole'], withQuery: true })),
    ];
  }
}
