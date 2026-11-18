/// <reference path="../pb_data/types.d.ts" />

// Tells the login page whether the first-run account still has to be created.
routerAdd('GET', '/api/setup', (e) => {
  return e.json(200, { needed: $app.countRecords('users') === 0 });
});

// Creates the only user. Refused as soon as one exists.
routerAdd('POST', '/api/setup', (e) => {
  if ($app.countRecords('users') > 0) {
    throw new ForbiddenError('Account già configurato.');
  }
  const body = e.requestInfo().body;
  const email = String(body.email || '').trim();
  const password = String(body.password || '');
  if (!email || password.length < 8) {
    throw new BadRequestError('Email e password (almeno 8 caratteri) obbligatorie.');
  }
  const record = new Record($app.findCollectionByNameOrId('users'));
  record.set('email', email);
  record.set('password', password);
  record.set('passwordConfirm', password);
  record.setVerified(true);
  $app.save(record);
  return e.json(200, { ok: true });
});
