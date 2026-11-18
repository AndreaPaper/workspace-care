/// <reference path="../pb_data/types.d.ts" />

// Stamp data_acquisto the first time a purchase reaches "ordinato" or "arrivato" (or later).
function stampPurchaseDate(e) {
  const s = require(`${__hooks}/lib/scadenze.js`);
  const placed = ['ordinato', 'arrivato', 'montato'].includes(e.record.getString('stato'));
  if (placed && !e.record.getString('data_acquisto')) {
    e.record.set('data_acquisto', s.format(s.todayLocal()));
  }
  e.next();
}
onRecordCreate(stampPurchaseDate, 'acquisti');
onRecordUpdate(stampPurchaseDate, 'acquisti');

// Converts an idea into a purchase. Optional body.link_id picks which link feeds supplier and URL.
// Idempotent: an idea that already has a purchase gets that one back.
routerAdd(
  'POST',
  '/api/idee/{id}/converti',
  (e) => {
    const body = e.requestInfo().body;
    const ideaId = e.request.pathValue('id');
    let result = null;

    $app.runInTransaction((tx) => {
      const idea = tx.findRecordById('idee', ideaId);

      try {
        const existing = tx.findFirstRecordByFilter('acquisti', 'idea = {:id}', { id: ideaId });
        result = { acquisto: existing, esistente: true, idea: idea };
        return;
      } catch (_) {
        // no purchase yet: create one below
      }

      let link = null;
      if (body.link_id) {
        link = tx.findRecordById('link_idea', String(body.link_id));
        if (link.getString('idea') !== ideaId) throw new BadRequestError('Il link non appartiene a questa idea.');
      } else {
        const links = tx.findRecordsByFilter('link_idea', 'idea = {:id}', 'created', 1, 0, { id: ideaId });
        link = links.length ? links[0] : null;
      }

      const purchase = new Record(tx.findCollectionByNameOrId('acquisti'));
      purchase.set('articolo', idea.getString('titolo'));
      purchase.set('area', idea.getString('area'));
      purchase.set('quantita', 1);
      purchase.set('idea', ideaId);
      purchase.set('stima_min', idea.getFloat('costo_min'));
      purchase.set('stima_max', idea.getFloat('costo_max'));
      purchase.set('stato', 'da_proporre');
      if (link) {
        purchase.set('link', link.getString('url'));
        purchase.set('fornitore', link.getString('sito'));
      }
      tx.save(purchase);

      if (['idea', 'da_valutare', 'proposta'].includes(idea.getString('stato'))) {
        idea.set('stato', 'approvata');
        tx.save(idea);
      }
      result = { acquisto: purchase, esistente: false, idea: idea };
    });

    return e.json(200, result);
  },
  $apis.requireAuth(),
);
