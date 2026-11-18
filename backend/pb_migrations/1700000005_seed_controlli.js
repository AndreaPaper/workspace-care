/// <reference path="../pb_data/types.d.ts" />
// Seed checks from the existing project (CLAUDE.md). The due date is filled by pb_hooks/controlli.pb.js.

migrate(
  (app) => {
    const areaId = (nome) => app.findFirstRecordByData('aree', 'nome', nome).id;
    const col = app.findCollectionByNameOrId('controlli');
    const checks = [
      { nome: 'Giro settimanale spazi comuni', area: 'spazi comuni', frequenza: 'settimanale', giorno: 1 },
      { nome: 'Pulizia frigorifero', area: 'cucina', frequenza: 'settimanale', giorno: 5 },
      { nome: 'Riordino terrazzo', area: 'terrazzo', frequenza: 'mensile', giorno: 1 },
    ];
    for (const c of checks) {
      const r = new Record(col);
      r.set('nome', c.nome);
      r.set('area', areaId(c.area));
      r.set('frequenza', c.frequenza);
      r.set('giorno', c.giorno);
      app.save(r);
    }
  },
  (app) => {
    app.truncateCollection(app.findCollectionByNameOrId('controlli'));
  },
);
