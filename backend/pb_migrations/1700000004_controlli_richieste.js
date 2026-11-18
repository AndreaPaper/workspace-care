/// <reference path="../pb_data/types.d.ts" />
// Phase 2 collections: controlli, esecuzioni_controllo, richieste.

migrate(
  (app) => {
    const authRule = '@request.auth.id != ""';
    const rules = { listRule: authRule, viewRule: authRule, createRule: authRule, updateRule: authRule, deleteRule: authRule };
    const aree = app.findCollectionByNameOrId('aree');
    const idee = app.findCollectionByNameOrId('idee');

    const controlli = new Collection({
      type: 'base',
      name: 'controlli',
      ...rules,
      fields: [
        { type: 'text', name: 'nome', required: true },
        { type: 'relation', name: 'area', collectionId: aree.id, maxSelect: 1 },
        { type: 'select', name: 'frequenza', required: true, maxSelect: 1, values: ['settimanale', 'mensile', 'trimestrale'] },
        // Weekly: 1 (lunedì) to 7 (domenica). Monthly and quarterly: day of the month, 1 to 28.
        { type: 'number', name: 'giorno', required: true, min: 1, max: 28, onlyInt: true },
        // Maintained by pb_hooks/controlli.pb.js; the "fatto" route moves it forward.
        { type: 'date', name: 'prossima_scadenza' },
        { type: 'autodate', name: 'created', onCreate: true },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
    });
    app.save(controlli);

    const esecuzioni = new Collection({
      type: 'base',
      name: 'esecuzioni_controllo',
      ...rules,
      fields: [
        { type: 'relation', name: 'controllo', required: true, collectionId: controlli.id, maxSelect: 1, cascadeDelete: true },
        { type: 'date', name: 'data', required: true },
        { type: 'select', name: 'esito', maxSelect: 1, values: ['ok', 'da_sistemare'] },
        { type: 'text', name: 'note' },
        { type: 'autodate', name: 'created', onCreate: true },
      ],
    });
    app.save(esecuzioni);

    const richieste = new Collection({
      type: 'base',
      name: 'richieste',
      ...rules,
      fields: [
        { type: 'text', name: 'titolo', required: true },
        { type: 'text', name: 'descrizione' },
        { type: 'text', name: 'richiedente' },
        { type: 'relation', name: 'area', collectionId: aree.id, maxSelect: 1 },
        { type: 'date', name: 'data' },
        {
          type: 'select',
          name: 'stato',
          required: true,
          maxSelect: 1,
          values: ['ricevuta', 'in_valutazione', 'in_corso', 'fatta', 'non_fattibile'],
        },
        { type: 'relation', name: 'idea', collectionId: idee.id, maxSelect: 1 },
        { type: 'text', name: 'note' },
        { type: 'autodate', name: 'created', onCreate: true },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
    });
    app.save(richieste);
  },
  (app) => {
    for (const name of ['richieste', 'esecuzioni_controllo', 'controlli']) {
      app.delete(app.findCollectionByNameOrId(name));
    }
  },
);
