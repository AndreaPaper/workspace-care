/// <reference path="../pb_data/types.d.ts" />
// Seed data from the existing project (CLAUDE.md).

migrate(
  (app) => {
    const areeNames = ['sala relax', 'stanza 2', 'stanza 3', 'ingresso', 'cucina', 'bagno uomini', 'terrazzo', 'spazi comuni'];
    const areaId = {};
    const areeCol = app.findCollectionByNameOrId('aree');
    for (const nome of areeNames) {
      const r = new Record(areeCol);
      r.set('nome', nome);
      app.save(r);
      areaId[nome] = r.id;
    }

    const ideas = [
      ['Armadietti stanza 2', 'stanza 2', 'arredo', ''],
      ['Armadietti stanza 3', 'stanza 3', 'arredo', ''],
      ['Due cassapanche sotto le finestre', 'sala relax', 'arredo', ''],
      ['Mobile angolare per i pacchi', 'ingresso', 'arredo', 'Mobile angolare, oppure due mobili dritti da 100 + 70 cm, profondità 30 cm, a giorno.'],
      ['Credenza in legno con ante', 'sala relax', 'arredo', 'Stile legno, con ante, per tazze e tupperware. Solo roba lavata e asciutta.'],
      ['Nuovo pouf', 'sala relax', 'arredo', ''],
      ['Ritinteggiatura macchia gialla', 'bagno uomini', 'manutenzione', ''],
      ['Pulizia o sostituzione tenda', 'terrazzo', 'manutenzione', ''],
      ['Riordino terrazzo', 'terrazzo', 'organizzazione', ''],
      ['Più cestini nelle stanze', 'spazi comuni', 'organizzazione', ''],
    ];
    const ideeCol = app.findCollectionByNameOrId('idee');
    for (const [titolo, area, categoria, descrizione] of ideas) {
      const r = new Record(ideeCol);
      r.set('titolo', titolo);
      r.set('area', areaId[area]);
      r.set('categoria', categoria);
      r.set('descrizione', descrizione);
      r.set('stato', 'idea');
      app.save(r);
    }
  },
  (app) => {
    app.truncateCollection(app.findCollectionByNameOrId('idee'));
    app.truncateCollection(app.findCollectionByNameOrId('aree'));
  },
);
