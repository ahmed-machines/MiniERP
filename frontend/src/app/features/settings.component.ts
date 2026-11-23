import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { I18nService } from '../core/i18n/i18n.service';
import { TranslatePipe } from '../core/i18n/pipes';
import { Settings } from '../core/models';
import { ToastService } from '../core/toast.service';
import { ErrComponent } from '../shared/components';

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule, TranslatePipe, ErrComponent],
  template: `
    <div class="page-header"><div><h1>{{ 'set.title' | t }}</h1><p>{{ 'set.subtitle' | t }}</p></div></div>
    @if (!auth.isAdmin()) { <div class="alert alert-info"><i class="bi bi-info-circle me-2"></i>{{ 'set.readOnly' | t }}</div> }
    @if (settings(); as s) {
      <form [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="row g-3">
          <div class="col-lg-7">
            <div class="card-x mb-3"><div class="card-x-header"><h6><i class="bi bi-building me-2"></i>{{ 'set.business' | t }}</h6></div>
              <div class="card-x-body"><div class="row g-3">
                <div class="col-md-6"><label class="form-label">{{ 'set.businessName' | t }} *</label><input class="form-control" formControlName="businessName" /><app-err [c]="form.controls.businessName" /></div>
                <div class="col-md-6"><label class="form-label">{{ 'set.businessNameAr' | t }}</label><input class="form-control" dir="rtl" formControlName="businessNameAr" /></div>
                <div class="col-md-6"><label class="form-label">{{ 'common.phone' | t }}</label><input class="form-control" dir="ltr" formControlName="phone" /></div>
                <div class="col-md-6"><label class="form-label">{{ 'common.email' | t }}</label><input class="form-control" formControlName="email" /><app-err [c]="form.controls.email" /></div>
                <div class="col-md-8"><label class="form-label">{{ 'common.address' | t }}</label><input class="form-control" formControlName="address" /></div>
                <div class="col-md-4"><label class="form-label">{{ 'set.taxId' | t }}</label><input class="form-control" formControlName="taxNumber" /></div>
              </div></div></div>
            <div class="card-x"><div class="card-x-header"><h6><i class="bi bi-receipt me-2"></i>{{ 'set.invoiceSettings' | t }}</h6></div>
              <div class="card-x-body"><div class="row g-3">
                <div class="col-md-6"><label class="form-label">{{ 'set.prefix' | t }} *</label><input class="form-control mono" formControlName="invoicePrefix" /><app-err [c]="form.controls.invoicePrefix" /></div>
                <div class="col-md-6"><label class="form-label">{{ 'set.nextNumber' | t }}</label><input type="number" min="1" class="form-control" formControlName="nextInvoiceNumber" /><div class="form-text">{{ 'set.nextNumberHint' | t }}</div></div>
                <div class="col-12"><label class="form-label">{{ 'set.footer' | t }}</label><textarea rows="2" class="form-control" formControlName="invoiceFooter"></textarea></div>
              </div></div></div>
          </div>
          <div class="col-lg-5">
            <div class="card-x mb-3"><div class="card-x-header"><h6><i class="bi bi-image me-2"></i>{{ 'set.logo' | t }}</h6></div>
              <div class="card-x-body d-flex align-items-center gap-3 flex-wrap">
                <div class="logo-preview">@if (s.hasLogo) { <img [src]="api.logoUrl + '?v=' + (s.logoUpdatedAt ?? '')" alt="logo" /> } @else { <small class="text-muted">{{ 'set.noLogo' | t }}</small> }</div>
                <div>
                  <div class="small text-muted mb-2">{{ 'set.logoHint' | t }}</div>
                  @if (auth.isAdmin()) {
                    <input #file type="file" accept="image/png,image/jpeg,image/webp" hidden (change)="upload(file)" />
                    <button type="button" class="btn btn-light btn-sm" (click)="file.click()"><i class="bi bi-upload me-1"></i>{{ 'set.uploadLogo' | t }}</button>
                    @if (s.hasLogo) { <button type="button" class="btn btn-light btn-sm text-danger ms-1" (click)="removeLogo()">{{ 'set.removeLogo' | t }}</button> }
                  }
                </div>
              </div></div>
            <div class="card-x"><div class="card-x-header"><h6><i class="bi bi-percent me-2"></i>{{ 'set.currencyTax' | t }}</h6></div>
              <div class="card-x-body"><div class="row g-3">
                <div class="col-6"><label class="form-label">{{ 'set.currencyCode' | t }} *</label><input class="form-control" formControlName="currencyCode" maxlength="10" /><app-err [c]="form.controls.currencyCode" /></div>
                <div class="col-6"><label class="form-label">{{ 'set.currencySymbol' | t }} *</label><input class="form-control" formControlName="currencySymbol" maxlength="10" /><app-err [c]="form.controls.currencySymbol" /></div>
                <div class="col-12"><div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="tx" formControlName="taxEnabled" /><label class="form-check-label" for="tx">{{ 'set.taxEnabled' | t }}</label></div></div>
                <div class="col-12"><label class="form-label">{{ 'set.taxRate' | t }}</label><input type="number" min="0" max="100" step="0.01" class="form-control" formControlName="taxRate" /><app-err [c]="form.controls.taxRate" /></div>
              </div></div></div>
          </div>
        </div>
        @if (auth.isAdmin()) {
          <div class="mt-3 text-end"><button class="btn btn-primary px-4" [disabled]="saving()">{{ (saving() ? 'common.saving' : 'common.save') | t }}</button></div>
        }
      </form>
    } @else { <div class="spinner-wrap"><div class="spinner-border text-primary"></div></div> }
  `
})
export class SettingsComponent implements OnInit {
  api = inject(ApiService);
  auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  private i18n = inject(I18nService);
  settings = signal<Settings | null>(null);
  saving = signal(false);
  form = this.fb.nonNullable.group({
    businessName: ['', [Validators.required, Validators.maxLength(200)]],
    businessNameAr: [''], phone: [''], email: ['', Validators.email], address: [''], taxNumber: [''],
    currencyCode: ['USD', [Validators.required, Validators.maxLength(10)]],
    currencySymbol: ['$', [Validators.required, Validators.maxLength(10)]],
    taxEnabled: [true], taxRate: [0, [Validators.min(0), Validators.max(100)]],
    invoicePrefix: ['INV-', [Validators.required, Validators.maxLength(20)]],
    nextInvoiceNumber: [1, [Validators.required, Validators.min(1)]],
    invoiceFooter: ['']
  });

  ngOnInit() {
    this.api.settings().subscribe({ next: (s) => this.apply(s), error: (e) => this.toast.httpError(e) });
  }
  private apply(s: Settings) {
    this.settings.set(s);
    this.i18n.currency.set(s.currencySymbol);
    this.form.reset({ ...s, businessNameAr: s.businessNameAr ?? '', phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '', taxNumber: s.taxNumber ?? '', invoiceFooter: s.invoiceFooter ?? '' });
    if (!this.auth.isAdmin()) this.form.disable();
  }
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.api.saveSettings({ ...v, businessNameAr: v.businessNameAr || null, phone: v.phone || null, email: v.email || null, address: v.address || null, taxNumber: v.taxNumber || null, invoiceFooter: v.invoiceFooter || null }).subscribe({
      next: (s) => { this.saving.set(false); this.apply(s); this.toast.success('set.saved'); },
      error: (e) => { this.saving.set(false); this.toast.httpError(e); }
    });
  }
  upload(input: HTMLInputElement) {
    const f = input.files?.[0];
    if (!f) return;
    this.api.uploadLogo(f).subscribe({
      next: (s) => { this.settings.set(s); this.toast.success('set.logoUpdated'); input.value = ''; },
      error: (e) => { this.toast.httpError(e); input.value = ''; }
    });
  }
  removeLogo() { this.api.deleteLogo().subscribe({ next: (s) => { this.settings.set(s); this.toast.success('set.logoRemoved'); }, error: (e) => this.toast.httpError(e) }); }
}
