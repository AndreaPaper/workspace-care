import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

/** Old addresses of the three sections now live as tabs of the Ufficio page, keeping any query parameters (e.g. ?q=). */
const toOffice = (tab: string) => ({ queryParams }: { queryParams: Record<string, string> }) =>
  inject(Router).createUrlTree(['/ufficio'], { queryParams: { ...queryParams, tab } });

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
      { path: 'ufficio/aree/:id', loadComponent: () => import('./pages/areas/area-detail').then((m) => m.AreaDetail) },
      { path: 'ufficio', loadComponent: () => import('./pages/office/office').then((m) => m.Office) },
      { path: 'inventario', redirectTo: toOffice('inventario') },
      { path: 'cassettiere', redirectTo: toOffice('cassettiere') },
      { path: 'regole/cartello', loadComponent: () => import('./pages/rules/rule-sign').then((m) => m.RuleSign) },
      { path: 'regole', loadComponent: () => import('./pages/rules/rules').then((m) => m.Rules) },
      { path: 'impostazioni', loadComponent: () => import('./pages/settings/settings').then((m) => m.Settings) },
      { path: 'riepilogo', loadComponent: () => import('./pages/report/report').then((m) => m.Report) },
      { path: 'aree', redirectTo: toOffice('aree') },
    ],
  },
  { path: '**', redirectTo: '' },
];
