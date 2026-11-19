import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login').then((m) => m.Login) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./core/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard) },
      { path: 'idee', loadComponent: () => import('./pages/ideas/ideas').then((m) => m.Ideas) },
      // Old links to a single idea keep working: the idea is now selected inside the Idee page.
      { path: 'idee/:id', redirectTo: ({ params }) => inject(Router).parseUrl('/idee?id=' + params['id']) },
      { path: 'richieste', loadComponent: () => import('./pages/requests/requests').then((m) => m.Requests) },
      { path: 'controlli', loadComponent: () => import('./pages/controls/controls').then((m) => m.Controls) },
      { path: 'acquisti', loadComponent: () => import('./pages/purchases/purchases').then((m) => m.Purchases) },
      { path: 'inventario', loadComponent: () => import('./pages/inventory/inventory').then((m) => m.Inventory) },
      { path: 'cassettiere', loadComponent: () => import('./pages/drawers/drawers').then((m) => m.Drawers) },
      { path: 'regole', loadComponent: () => import('./pages/rules/rules').then((m) => m.Rules) },
      { path: 'riepilogo', loadComponent: () => import('./pages/report/report').then((m) => m.Report) },
      { path: 'aree', loadComponent: () => import('./pages/areas/areas').then((m) => m.Areas) },
    ],
  },
  { path: '**', redirectTo: '' },
];
