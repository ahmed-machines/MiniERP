import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./layout/login.component').then((m) => m.LoginComponent) },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard.component').then((m) => m.DashboardComponent) },
      { path: 'products', loadComponent: () => import('./features/products.component').then((m) => m.ProductsComponent) },
      { path: 'customers', loadComponent: () => import('./features/customers.component').then((m) => m.CustomersComponent) },
      { path: 'customers/:id', loadComponent: () => import('./features/customer-detail.component').then((m) => m.CustomerDetailComponent) },
      { path: 'invoices', loadComponent: () => import('./features/invoices.component').then((m) => m.InvoicesComponent) },
      { path: 'invoices/new', loadComponent: () => import('./features/invoice-new.component').then((m) => m.InvoiceNewComponent) },
      { path: 'invoices/:id', loadComponent: () => import('./features/invoice-detail.component').then((m) => m.InvoiceDetailComponent) },
      { path: 'users', canActivate: [roleGuard('Admin')], loadComponent: () => import('./features/users.component').then((m) => m.UsersComponent) },
      { path: 'settings', loadComponent: () => import('./features/settings.component').then((m) => m.SettingsComponent) },
      { path: '**', loadComponent: () => import('./features/not-found.component').then((m) => m.NotFoundComponent) }
    ]
  },
  { path: '**', redirectTo: '' }
];
