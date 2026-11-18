/// <reference path="../pb_data/types.d.ts" />
// Phase 1 collections: aree, idee, link_idea.

migrate(
  (app) => {
    const authRule = '@request.auth.id != ""';
    const rules = {
      listRule: authRule,
      viewRule: authRule,
      createRule: authRule,
      updateRule: authRule,
      deleteRule: authRule,
    };
    const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    const aree = new Collection({
      type: 'base',
      name: 'aree',
      ...rules,
      fields: [{ type: 'text', name: 'nome', required: true }],
      indexes: ['CREATE UNIQUE INDEX idx_aree_nome ON aree (nome)'],
    });
    app.save(aree);

    const idee = new Collection({
      type: 'base',
      name: 'idee',
      ...rules,
      fields: [
        { type: 'text', name: 'titolo', required: true },
        { type: 'text', name: 'descrizione' },
        { type: 'select', name: 'categoria', maxSelect: 1, values: ['arredo', 'manutenzione', 'organizzazione', 'regole', 'benessere'] },
        { type: 'relation', name: 'area', collectionId: aree.id, maxSelect: 1, cascadeDelete: false },
        {
          type: 'select',
          name: 'stato',
          required: true,
          maxSelect: 1,
          values: ['idea', 'da_valutare', 'proposta', 'approvata', 'in_corso', 'fatta', 'scartata'],
        },
        { type: 'select', name: 'priorita', maxSelect: 1, values: ['bassa', 'media', 'alta'] },
        { type: 'number', name: 'costo_min', min: 0 },
        { type: 'number', name: 'costo_max', min: 0 },
        { type: 'file', name: 'foto', maxSelect: 20, maxSize: 10485760, mimeTypes: imageTypes, thumbs: ['300x200', '400x300'] },
        { type: 'text', name: 'note' },
        { type: 'autodate', name: 'created', onCreate: true },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
    });
    app.save(idee);

    const linkIdea = new Collection({
      type: 'base',
      name: 'link_idea',
      ...rules,
      fields: [
        { type: 'relation', name: 'idea', required: true, collectionId: idee.id, maxSelect: 1, cascadeDelete: true },
        { type: 'url', name: 'url', required: true },
        { type: 'text', name: 'titolo' },
        { type: 'text', name: 'sito' },
        { type: 'file', name: 'immagine', maxSelect: 1, maxSize: 10485760, mimeTypes: imageTypes, thumbs: ['300x200', '400x300'] },
        // Manual fallback: paste an image URL, the server downloads it (see pb_hooks/anteprima.pb.js).
        { type: 'url', name: 'immagine_url' },
        { type: 'text', name: 'prezzo' },
        { type: 'select', name: 'stato_anteprima', maxSelect: 1, values: ['ok', 'parziale', 'fallita'] },
        { type: 'autodate', name: 'created', onCreate: true },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
    });
    app.save(linkIdea);
  },
  (app) => {
    for (const name of ['link_idea', 'idee', 'aree']) {
      app.delete(app.findCollectionByNameOrId(name));
    }
  },
);
