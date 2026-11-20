/// <reference path="../pb_data/types.d.ts" />
// A fourth type of drawer: "con_roba" = there is stuff in it that belongs to nobody (not free, not assigned).
// Existing drawers keep their type.

migrate(
  (app) => {
    const cassetti = app.findCollectionByNameOrId('cassetti');
    const tipo = cassetti.fields.getByName('tipo');
    tipo.values = ['personale', 'condiviso', 'libero', 'con_roba'];
    app.save(cassetti);
  },
  (app) => {
    // Drawers marked "con_roba" become free again before the value is removed.
    app.db().newQuery("UPDATE cassetti SET tipo = 'libero' WHERE tipo = 'con_roba'").execute();
    const cassetti = app.findCollectionByNameOrId('cassetti');
    const tipo = cassetti.fields.getByName('tipo');
    tipo.values = ['personale', 'condiviso', 'libero'];
    app.save(cassetti);
  },
);
