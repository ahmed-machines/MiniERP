import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { I18nService } from '../core/i18n/i18n.service';
import { TranslatePipe } from '../core/i18n/pipes';
import { PublicSettings } from '../core/models';
import { ToastService } from '../core/toast.service';
import { ErrComponent } from '../shared/components';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, TranslatePipe, ErrComponent],
  template: `
    <div class="login-page">
      <section class="login-hero d-none d-lg-flex">
        <div>
          <div class="brand-logo big"><i class="bi bi-boxes"></i></div>
          @if (businessTitle()) { <div class="text-uppercase small fw-semibold mb-2" style="letter-spacing:.08em;color:#a5b4fc">{{ businessTitle() }}</div> }
          <h1>{{ 'auth.heroTitle' | t }}</h1>
          <p>{{ 'auth.heroText' | t }}</p>
          <ul>
            <li><i class="bi bi-check2-circle"></i>{{ 'auth.feature1' | t }}</li>
            <li><i class="bi bi-check2-circle"></i>{{ 'auth.feature2' | t }}</li>
            <li><i class="bi bi-check2-circle"></i>{{ 'auth.feature3' | t }}</li>
          </ul>
        </div>
      </section>
      <section class="login-form-wrap">
        <div class="lang-switch floating">
          <button [class.active]="i18n.lang() === 'en'" (click)="i18n.setLang('en')">EN</button>
          <button [class.active]="i18n.lang() === 'ar'" (click)="i18n.setLang('ar')">عربي</button>
        </div>
        <form class="login-card" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          @if (brand()?.hasLogo) { <img [src]="api.logoUrl + '?v=' + (brand()!.logoUpdatedAt ?? '')" class="login-logo" alt="" /> }
          @else if (businessTitle()) { <div class="small fw-semibold text-primary mb-2">{{ businessTitle() }}</div> }
          <h2>{{ 'auth.welcome' | t }}</h2>
          <p class="text-muted mb-4">{{ 'auth.subtitle' | t }}</p>
          @if (expired) { <div class="alert alert-warning py-2">{{ 'err.unauthorized' | t }}</div> }
          <div class="mb-3">
            <label class="form-label">{{ 'auth.username' | t }}</label>
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-person"></i></span>
              <input class="form-control" formControlName="username" autocomplete="username" autofocus />
            </div>
            <app-err [c]="form.controls.username" />
          </div>
          <div class="mb-4">
            <label class="form-label">{{ 'auth.password' | t }}</label>
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-lock"></i></span>
              <input class="form-control" type="password" formControlName="password" autocomplete="current-password" />
            </div>
            <app-err [c]="form.controls.password" />
          </div>
          <button class="btn btn-primary w-100 py-2" [disabled]="loading()">
            @if (loading()) { <span class="spinner-border spinner-border-sm me-2"></span>{{ 'auth.signingIn' | t }} } @else { {{ 'auth.signIn' | t }} }
          </button>
          @if (demo) {
            <div class="demo-box mt-4">
              <small class="text-muted d-block mb-2">{{ 'auth.demo' | t }}</small>
              <div class="d-flex gap-2">
                <button type="button" class="btn btn-sm btn-outline-secondary flex-fill" (click)="fill('admin', 'Admin@123')">{{ 'auth.useAdmin' | t }}</button>
                <button type="button" class="btn btn-sm btn-outline-secondary flex-fill" (click)="fill('cashier', 'Cashier@123')">{{ 'auth.useCashier' | t }}</button>
              </div>
            </div>
          }
        </form>
      </section>
    </div>
  `
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  api = inject(ApiService);
  i18n = inject(I18nService);
  loading = signal(false);
  brand = signal<PublicSettings | null>(null);
  expired = inject(ActivatedRoute).snapshot.queryParamMap.has('expired');
  demo = location.hostname === 'localhost';

  form = this.fb.nonNullable.group({ username: ['', Validators.required], password: ['', Validators.required] });

  constructor() { if (this.auth.isLoggedIn()) this.router.navigate(['/dashboard']); }

  ngOnInit() {
    this.api.publicSettings().subscribe({ next: (b) => this.brand.set(b), error: () => {} });
  }

  businessTitle() {
    const b = this.brand();
    return this.i18n.lang() === 'ar' && b?.businessNameAr ? b.businessNameAr : b?.businessName;
  }

  fill(u: string, p: string) { this.form.setValue({ username: u, password: p }); }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    const { username, password } = this.form.getRawValue();
    this.auth.login(username, password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (e) => { this.loading.set(false); this.toast.httpError(e); }
    });
  }
}
