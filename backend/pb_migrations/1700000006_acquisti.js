/// <reference path="../pb_data/types.d.ts" />
// Phase 3 collection: acquisti.

migrate(
  (app) => {
    const authRule = '@request.auth.id != ""';
    const aree = app.findCollectionByNameOrId('aree');
    const idee = app.findCollectionByNameOrId('idee');

    const acquisti = new Collection({
      type: 'base',
      name: 'acquisti',
      listRule: authRule,
      viewRule: authRule,
      createRule: authRule,
      updateRule: authRule,
      deleteRule: authRule,
      fields: [
        { type: 'text', name: 'articolo', required: true },
        { type: 'relation', name: 'area', collectionId: aree.id, maxSelect: 1 },
        { type: 'number', name: 'quantita', min: 1, onlyInt: true },
        { type: 'relation', name: 'idea', collectionId: idee.id, maxSelect: 1 },
        { type: 'text', name: 'fornitore' },
        { type: 'url', name: 'link' },
        // Estimates and actual price are totals for the whole row (quantity already included).
        { type: 'number', name: 'stima_min', min: 0 },
        { type: 'number', name: 'stima_max', min: 0 },
        { type: 'number', name: 'prezzo_effettivo', min: 0 },
        {
          type: 'select',
          name: 'stato',
          required: true,
          maxSelect: 1,
          values: ['da_proporre', 'approvato', 'ordinato', 'arrivato', 'montato'],
        },
        // Set by pb_hooks/acquisti.pb.js when the purchase is first ordered or received.
        { type: 'date', name: 'data_acquisto' },
        { type: 'autodate', name: 'created', onCreate: true },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
    });
    app.save(acquisti);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('acquisti'));
  },
);
