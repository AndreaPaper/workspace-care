/// <reference path="../pb_data/types.d.ts" />
// Checks can also repeat every two weeks ("bisettimanale").

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('controlli');
    const field = col.fields.getByName('frequenza');
    field.values = ['settimanale', 'bisettimanale', 'mensile', 'trimestrale'];
    app.save(col);
  },
  (app) => {
    const col = app.findCollectionByNameOrId('controlli');
    const field = col.fields.getByName('frequenza');
    field.values = ['settimanale', 'mensile', 'trimestrale'];
    app.save(col);
  },
);
