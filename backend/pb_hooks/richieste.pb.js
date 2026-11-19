/// <reference path="../pb_data/types.d.ts" />

// Every request gets a history: "Ricevuta" when created, "Passata a «…»" at each status change.
// Free notes are added by the app as events of type "nota".
onRecordAfterCreateSuccess((e) => {
  const h = require(`${__hooks}/lib/richieste.js`);
  h.logEvent(e.app, e.record.id, 'stato', h.receivedText(e.record));
  e.next();
}, 'richieste');

onRecordUpdate((e) => {
  const h = require(`${__hooks}/lib/richieste.js`);
  const before = e.record.original().getString('stato');
  const after = e.record.getString('stato');
  e.next();
  if (before !== after) h.logEvent(e.app, e.record.id, 'stato', h.changedText(after));
}, 'richieste');
