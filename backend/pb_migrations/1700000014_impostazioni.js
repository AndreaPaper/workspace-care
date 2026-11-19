/// <reference path="../pb_data/types.d.ts" />
// Office settings kept with the data (so a backup carries them): one record with the optional annual purchase budget
// and the month the budget year starts.

migrate(
  (app) => {
    const authRule = '@request.auth.id != ""';
    app.save(
      new Collection({
        type: 'base',
        name: 'impostazioni',
        listRule: authRule,
        viewRule: authRule,
        createRule: authRule,
        updateRule: authRule,
        deleteRule: authRule,
        fields: [
          { type: 'number', name: 'budget_annuale', min: 0 },
          { type: 'number', name: 'inizio_anno_mese', min: 1, max: 12, onlyInt: true },
          { type: 'autodate', name: 'created', onCreate: true },
          { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
        ],
      }),
    );
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('impostazioni'));
  },
);
