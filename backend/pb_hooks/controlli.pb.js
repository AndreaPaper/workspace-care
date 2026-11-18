/// <reference path="../pb_data/types.d.ts" />

// Fill or recompute prossima_scadenza when a check is created, or when its frequency or day changes.
// Model hooks (not request hooks) so that seed migrations are covered too.
onRecordCreate((e) => {
  const s = require(`${__hooks}/lib/scadenze.js`);
  if (!e.record.getString('prossima_scadenza')) {
    const d = s.initialDue(e.record.getString('frequenza'), e.record.getInt('giorno'), s.todayLocal());
    e.record.set('prossima_scadenza', s.format(d));
  }
  e.next();
}, 'controlli');

onRecordUpdate((e) => {
  const s = require(`${__hooks}/lib/scadenze.js`);
  const orig = e.record.original();
  const changed =
    e.record.getString('frequenza') !== orig.getString('frequenza') || e.record.getInt('giorno') !== orig.getInt('giorno');
  if (changed) {
    const d = s.initialDue(e.record.getString('frequenza'), e.record.getInt('giorno'), s.todayLocal());
    e.record.set('prossima_scadenza', s.format(d));
  }
  e.next();
}, 'controlli');

// Marks a check as done: records the execution and moves the due date forward, in one transaction.
routerAdd(
  'POST',
  '/api/controlli/{id}/fatto',
  (e) => {
    const s = require(`${__hooks}/lib/scadenze.js`);
    const body = e.requestInfo().body;
    const esito = body.esito === 'da_sistemare' ? 'da_sistemare' : 'ok';
    const note = String(body.note || '');
    const today = s.todayLocal();

    let result = null;
    $app.runInTransaction((tx) => {
      const check = tx.findRecordById('controlli', e.request.pathValue('id'));

      const run = new Record(tx.findCollectionByNameOrId('esecuzioni_controllo'));
      run.set('controllo', check.id);
      run.set('data', s.format(today));
      run.set('esito', esito);
      run.set('note', note);
      tx.save(run);

      const next = s.nextAfterDone(check.getString('frequenza'), check.getInt('giorno'), today);
      check.set('prossima_scadenza', s.format(next));
      tx.save(check);
      result = check;
    });
    return e.json(200, result);
  },
  $apis.requireAuth(),
);
