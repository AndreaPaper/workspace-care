/// <reference path="../pb_data/types.d.ts" />
// Phase 4 collections: inventario, cassettiere, regole (with the three rules still to define).

migrate(
  (app) => {
    const authRule = '@request.auth.id != ""';
    const rules = { listRule: authRule, viewRule: authRule, createRule: authRule, updateRule: authRule, deleteRule: authRule };
    const aree = app.findCollectionByNameOrId('aree');
    const timestamps = [
      { type: 'autodate', name: 'created', onCreate: true },
      { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
    ];

    app.save(
      new Collection({
        type: 'base',
        name: 'inventario',
        ...rules,
        fields: [
          { type: 'text', name: 'nome', required: true },
          { type: 'relation', name: 'area', collectionId: aree.id, maxSelect: 1 },
          { type: 'text', name: 'posizione' },
          { type: 'text', name: 'note' },
          ...timestamps,
        ],
      }),
    );

    app.save(
      new Collection({
        type: 'base',
        name: 'cassettiere',
        ...rules,
        fields: [
          { type: 'number', name: 'numero', required: true, min: 1, onlyInt: true },
          { type: 'relation', name: 'area', collectionId: aree.id, maxSelect: 1 },
          { type: 'select', name: 'tipo', required: true, maxSelect: 1, values: ['personale', 'condivisa'] },
          { type: 'text', name: 'assegnata_a' },
          ...timestamps,
        ],
        indexes: ['CREATE UNIQUE INDEX idx_cassettiere_numero ON cassettiere (numero)'],
      }),
    );

    const regole = new Collection({
      type: 'base',
      name: 'regole',
      ...rules,
      fields: [
        { type: 'select', name: 'tema', required: true, maxSelect: 1, values: ['cassettiere', 'cucina', 'frigorifero', 'altro'] },
        { type: 'text', name: 'testo', required: true },
        { type: 'select', name: 'stato', required: true, maxSelect: 1, values: ['da_definire', 'bozza', 'attiva'] },
        ...timestamps,
      ],
    });
    app.save(regole);

    const seed = [
      ['cassettiere', 'Cassettiere: personale oppure condivisa per chi viene meno di 3 volte a settimana.'],
      ['cucina', 'Zona cucina: le tazze vanno lavate con sapone prima di metterle nello scolapiatti.'],
      ['frigorifero', 'Frigorifero: cosa fare con il cibo lasciato a lungo e scaduto.'],
    ];
    for (const [tema, testo] of seed) {
      const r = new Record(regole);
      r.set('tema', tema);
      r.set('testo', testo);
      r.set('stato', 'da_definire');
      app.save(r);
    }
  },
  (app) => {
    for (const name of ['regole', 'cassettiere', 'inventario']) {
      app.delete(app.findCollectionByNameOrId(name));
    }
  },
);
