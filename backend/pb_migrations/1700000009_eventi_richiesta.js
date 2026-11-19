/// <reference path="../pb_data/types.d.ts" />
// History of a colleague request: creation, every status change (written by pb_hooks/richieste.pb.js)
// and free notes added from the app.

migrate(
  (app) => {
    const authRule = '@request.auth.id != ""';
    const richieste = app.findCollectionByNameOrId('richieste');

    const eventi = new Collection({
      type: 'base',
      name: 'eventi_richiesta',
      listRule: authRule,
      viewRule: authRule,
      createRule: authRule,
      updateRule: authRule,
      deleteRule: authRule,
      fields: [
        { type: 'relation', name: 'richiesta', required: true, collectionId: richieste.id, maxSelect: 1, cascadeDelete: true },
        { type: 'select', name: 'tipo', required: true, maxSelect: 1, values: ['stato', 'nota'] },
        { type: 'text', name: 'testo', required: true },
        { type: 'date', name: 'data' },
        { type: 'autodate', name: 'created', onCreate: true },
      ],
    });
    app.save(eventi);

    // Requests that already exist get their "received" event.
    const existing = app.findRecordsByFilter('richieste', '', 'created', 0, 0);
    for (const r of existing) {
      const ev = new Record(eventi);
      ev.set('richiesta', r.id);
      ev.set('tipo', 'stato');
      ev.set('testo', r.getString('richiedente') ? 'Ricevuta da ' + r.getString('richiedente') : 'Ricevuta');
      ev.set('data', r.getString('data') || r.getString('created'));
      app.save(ev);
    }
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('eventi_richiesta'));
  },
);
