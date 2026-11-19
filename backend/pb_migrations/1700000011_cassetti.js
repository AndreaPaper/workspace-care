/// <reference path="../pb_data/types.d.ts" />
// Single drawers: a "cassettiera" (drawer unit) now holds several "cassetti", each personal, shared or free,
// so a person can have just one drawer of a unit. "tipo" and "assegnata_a" move from the unit to its drawers.
// Existing units are not converted: they simply start without drawers.

migrate(
  (app) => {
    const authRule = '@request.auth.id != ""';
    const cassettiere = app.findCollectionByNameOrId('cassettiere');

    const cassetti = new Collection({
      type: 'base',
      name: 'cassetti',
      listRule: authRule,
      viewRule: authRule,
      createRule: authRule,
      updateRule: authRule,
      deleteRule: authRule,
      fields: [
        { type: 'relation', name: 'cassettiera', required: true, collectionId: cassettiere.id, maxSelect: 1, cascadeDelete: true },
        { type: 'number', name: 'numero', required: true, min: 1, onlyInt: true },
        { type: 'select', name: 'tipo', required: true, maxSelect: 1, values: ['personale', 'condiviso', 'libero'] },
        { type: 'text', name: 'assegnato_a' },
        { type: 'text', name: 'contenuto' },
        { type: 'autodate', name: 'created', onCreate: true },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_cassetti_cassettiera_numero ON cassetti (cassettiera, numero)'],
    });
    app.save(cassetti);

    cassettiere.fields.removeByName('tipo');
    cassettiere.fields.removeByName('assegnata_a');
    app.save(cassettiere);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('cassetti'));
    const cassettiere = app.findCollectionByNameOrId('cassettiere');
    cassettiere.fields.add(new SelectField({ name: 'tipo', maxSelect: 1, values: ['personale', 'condivisa'] }));
    cassettiere.fields.add(new TextField({ name: 'assegnata_a' }));
    app.save(cassettiere);
  },
);
