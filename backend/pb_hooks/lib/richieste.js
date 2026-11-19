// Helpers for the request history. Loaded with require() inside the hook handlers.

const LABELS = {
  ricevuta: 'Ricevuta',
  in_valutazione: 'In valutazione',
  in_corso: 'In corso',
  fatta: 'Fatta',
  non_fattibile: 'Non fattibile',
};

function logEvent(app, requestId, tipo, testo) {
  const ev = new Record(app.findCollectionByNameOrId('eventi_richiesta'));
  ev.set('richiesta', requestId);
  ev.set('tipo', tipo);
  ev.set('testo', testo);
  ev.set('data', new Date().toISOString().replace('T', ' '));
  app.save(ev);
}

function receivedText(record) {
  const who = record.getString('richiedente');
  return who ? 'Ricevuta da ' + who : 'Ricevuta';
}

function changedText(status) {
  return 'Passata a «' + (LABELS[status] || status) + '»';
}

module.exports = { logEvent, receivedText, changedText };
