/// <reference path="../pb_data/types.d.ts" />
// Optional area on the rules, so that the page of an area can show its own rules.
// The relation is not required: deleting an area only empties the link of its rules.

migrate(
  (app) => {
    const aree = app.findCollectionByNameOrId('aree');
    const regole = app.findCollectionByNameOrId('regole');
    regole.fields.add(new RelationField({ name: 'area', collectionId: aree.id, maxSelect: 1 }));
    app.save(regole);
  },
  (app) => {
    const regole = app.findCollectionByNameOrId('regole');
    regole.fields.removeByName('area');
    app.save(regole);
  },
);
