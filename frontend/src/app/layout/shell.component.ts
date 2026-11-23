import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { I18nService } from '../core/i18n/i18n.service';
import { TranslatePipe } from '../core/i18n/pipes';
import { ToastService } from '../core/toast.service';
import { ModalComponent } from '../shared/components';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, ModalComponent, FormsModule],
  template: `
    <div class="app-shell" [class.sidebar-open]="open()">
      <aside class="sidebar">
        <a class="brand" routerLink="/dashboard">
          <span class="brand-logo"><i class="bi bi-boxes"></i></span>
          <span><strong>{{ 'app.name' | t }}</strong><small>{{ 'app.tagline' | t }}</small></span>
        </a>
        <nav class="nav-groups" (click)="open.set(false)">
          <div class="nav-title">{{ 'nav.main' | t }}</div>
          <a routerLink="/dashboard" routerLinkActive="active"><i class="bi bi-speedometer2"></i>{{ 'nav.dashboard' | t }}</a>
          <div class="nav-title">{{ 'nav.sales' | t }}</div>
          <a routerLink="/invoices/new" routerLinkActive="active"><i class="bi bi-plus-circle"></i>{{ 'nav.newInvoice' | t }}</a>
          <a routerLink="/invoices" [routerLinkActiveOptions]="{ exact: true }" routerLinkActive="active"><i class="bi bi-receipt"></i>{{ 'nav.invoices' | t }}</a>
          <a routerLink="/customers" routerLinkActive="active"><i class="bi bi-people"></i>{{ 'nav.customers' | t }}</a>
          <div class="nav-title">{{ 'nav.inventory' | t }}</div>
          <a routerLink="/products" routerLinkActive="active"><i class="bi bi-box-seam"></i>{{ 'nav.products' | t }}</a>
          <div class="nav-title">{{ 'nav.administration' | t }}</div>
          @if (auth.isAdmin()) {
            <a routerLink="/users" routerLinkActive="active"><i class="bi bi-person-gear"></i>{{ 'nav.users' | t }}</a>
          }
          <a routerLink="/settings" routerLinkActive="active"><i class="bi bi-gear"></i>{{ 'nav.settings' | t }}</a>
        </nav>
      </aside>
      @if (open()) { <div class="sidebar-scrim" (click)="open.set(false)"></div> }

      <div class="main">
        <header class="topbar">
          <button class="btn btn-light d-lg-none" (click)="open.set(!open())" aria-label="menu"><i class="bi bi-list fs-5"></i></button>
          <div class="flex-grow-1"></div>
          <div class="lang-switch" role="group" aria-label="language">
            <button [class.active]="i18n.lang() === 'en'" (click)="i18n.setLang('en')">EN</button>
            <button [class.active]="i18n.lang() === 'ar'" (click)="i18n.setLang('ar')">عربي</button>
          </div>
          <div class="dropdown user-menu">
            <button class="user-btn" (click)="$event.stopPropagation(); menu.set(!menu())">
              <span class="avatar">{{ initials() }}</span>
              <span class="d-none d-md-flex flex-column text-start lh-sm">
                <strong>{{ auth.user()?.fullName }}</strong>
                <small class="text-muted">{{ 'role.' + auth.user()?.role | t }}</small>
              </span>
              <i class="bi bi-chevron-down small text-muted"></i>
            </button>
            @if (menu()) {
              <div class="dropdown-menu show shadow border-0 p-2" (click)="menu.set(false)">
                <button class="dropdown-item rounded" (click)="pwOpen.set(true)"><i class="bi bi-key me-2"></i>{{ 'auth.changePassword' | t }}</button>
                <button class="dropdown-item rounded text-danger" (click)="auth.logout()"><i class="bi bi-box-arrow-right me-2"></i>{{ 'nav.logout' | t }}</button>
              </div>
            }
          </div>
        </header>
        <main class="content"><router-outlet /></main>
      </div>
    </div>

    @if (pwOpen()) {
      <app-modal [title]="'auth.changePassword' | t" (closed)="pwOpen.set(false)">
        <div class="modal-body">
          <label class="form-label">{{ 'auth.currentPassword' | t }}</label>
          <input type="password" class="form-control mb-3" [(ngModel)]="curPw" autocomplete="current-password" />
          <label class="form-label">{{ 'auth.newPassword' | t }}</label>
          <input type="password" class="form-control" [(ngModel)]="newPw" autocomplete="new-password" minlength="8" />
          @if (newPw && newPw.length < 8) { <div class="invalid-feedback d-block">{{ 'val.minLength' | t: { min: 8 } }}</div> }
        </div>
        <div class="modal-footer">
          <button class="btn btn-light" (click)="pwOpen.set(false)">{{ 'common.cancel' | t }}</button>
          <button class="btn btn-primary" [disabled]="!curPw || newPw.length < 8" (click)="changePw()">{{ 'common.save' | t }}</button>
        </div>
      </app-modal>
    }
  `,
  host: { '(document:click)': 'menu.set(false)' }
})
export class ShellComponent {
  auth = inject(AuthService);
  i18n = inject(I18nService);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  open = signal(false);
  menu = signal(false);
  pwOpen = signal(false);
  curPw = ''; newPw = '';

  constructor() {
    this.api.settings().subscribe({ next: (s) => this.i18n.currency.set(s.currencySymbol), error: () => {} });
  }

  initials() {
    return (this.auth.user()?.fullName ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  }
  changePw() {
    this.api.changePassword(this.curPw, this.newPw).subscribe({
      next: () => { this.toast.success('auth.passwordChanged'); this.pwOpen.set(false); this.curPw = this.newPw = ''; },
      error: (e) => this.toast.httpError(e)
    });
  }
}
