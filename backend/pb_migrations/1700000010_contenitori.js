/// <reference path="../pb_data/types.d.ts" />
// Containers for the inventory: "contenitori" (a cabinet, a box...) and an optional "contenitore" link on each item.
// Deleting a container empties the link of its items (the relation is not required), so items are never lost.

migrate(
  (app) => {
    const authRule = '@request.auth.id != ""';
    const aree = app.findCollectionByNameOrId('aree');
    const inventario = app.findCollectionByNameOrId('inventario');

    const contenitori = new Collection({
      type: 'base',
      name: 'contenitori',
      listRule: authRule,
      viewRule: authRule,
      createRule: authRule,
      updateRule: authRule,
      deleteRule: authRule,
      fields: [
        { type: 'text', name: 'nome', required: true },
        { type: 'relation', name: 'area', collectionId: aree.id, maxSelect: 1 },
        { type: 'text', name: 'descrizione' },
        { type: 'autodate', name: 'created', onCreate: true },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
    });
    app.save(contenitori);

    inventario.fields.add(new RelationField({ name: 'contenitore', collectionId: contenitori.id, maxSelect: 1 }));
    app.save(inventario);
  },
  (app) => {
    const inventario = app.findCollectionByNameOrId('inventario');
    inventario.fields.removeByName('contenitore');
    app.save(inventario);
    app.delete(app.findCollectionByNameOrId('contenitori'));
  },
);
