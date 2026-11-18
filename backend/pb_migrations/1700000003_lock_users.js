/// <reference path="../pb_data/types.d.ts" />
// Single-user app: nobody can self-register. The first user is created through
// POST /api/setup (pb_hooks/setup.pb.js), which only works while no user exists.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.createRule = null;
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.createRule = '';
    app.save(users);
  },
);
