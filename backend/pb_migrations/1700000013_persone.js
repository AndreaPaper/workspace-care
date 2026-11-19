/// <reference path="../pb_data/types.d.ts" />
// The colleagues of the office: an optional list of names that the drawer and request forms suggest.
// Drawers and requests keep free text ("assegnato_a", "richiedente"), so nothing breaks when a name is not in the list.

migrate(
  (app) => {
    const authRule = '@request.auth.id != ""';
    app.save(
      new Collection({
        type: 'base',
        name: 'persone',
        listRule: authRule,
        viewRule: authRule,
        createRule: authRule,
        updateRule: authRule,
        deleteRule: authRule,
        fields: [
          { type: 'text', name: 'nome', required: true },
          { type: 'autodate', name: 'created', onCreate: true },
          { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_persone_nome ON persone (nome COLLATE NOCASE)'],
      }),
    );
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('persone'));
  },
);
