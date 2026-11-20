/// <reference path="../pb_data/types.d.ts" />
// A thumbnail of the link image that keeps the whole picture ("480x0": 480 px wide, height follows), so that
// a product photo or a screenshot is not cropped like the "400x300" thumbnail does.

migrate(
  (app) => {
    const links = app.findCollectionByNameOrId('link_idea');
    const field = links.fields.getByName('immagine');
    field.thumbs = ['300x200', '400x300', '480x0'];
    app.save(links);
  },
  (app) => {
    const links = app.findCollectionByNameOrId('link_idea');
    const field = links.fields.getByName('immagine');
    field.thumbs = ['300x200', '400x300'];
    app.save(links);
  },
);
