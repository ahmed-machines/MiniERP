import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { I18nService } from '../core/i18n/i18n.service';
import { LocalDatePipe, MoneyPipe, NumberPipe, TranslatePipe } from '../core/i18n/pipes';
import { InvoiceDetail, Settings } from '../core/models';
import { ToastService } from '../core/toast.service';
import { ModalComponent } from '../shared/components';

@Component({
  selector: 'app-invoice-detail',
  imports: [FormsModule, RouterLink, TranslatePipe, MoneyPipe, NumberPipe, LocalDatePipe, ModalComponent],
  template: `
    <div class="page-header no-print">
      <div class="d-flex align-items-center gap-2">
        <a routerLink="/invoices" class="btn btn-light btn-icon"><i class="bi" [class.bi-arrow-left]="!i18n.isRtl()" [class.bi-arrow-right]="i18n.isRtl()"></i></a>
        <h1 class="mono">{{ inv()?.invoiceNumber }}</h1>
        @if (inv(); as i) { <span class="badge" [class]="i.status === 'Paid' ? 'b-soft-success' : 'b-soft-danger'">{{ 'status.' + i.status | t }}</span> }
      </div>
      <div class="d-flex gap-2">
        @if (auth.isAdmin() && inv()?.status === 'Paid') {
          <button class="btn btn-light text-danger" (click)="cancelOpen.set(true)"><i class="bi bi-x-octagon me-1"></i>{{ 'inv.cancel' | t }}</button>
        }
        <button class="btn btn-primary" (click)="print()"><i class="bi bi-printer me-1"></i>{{ 'common.print' | t }}</button>
      </div>
    </div>

    @if (!inv() || !settings()) { <div class="spinner-wrap"><div class="spinner-border text-primary"></div></div> }
    @else {
      @let i = inv()!; @let s = settings()!;
      @if (i.status === 'Cancelled') {
        <div class="alert alert-danger no-print d-flex gap-2 align-items-center"><i class="bi bi-x-octagon-fill"></i>
          <div><strong>{{ 'inv.cancelledBanner' | t }}</strong> — {{ 'inv.cancelledOn' | t: { date: (i.cancelledAt | ldate: 'datetime') } }}@if (i.cancelReason) { · {{ i.cancelReason }} }</div></div>
      }
      <div class="invoice-paper">
        @if (i.status === 'Cancelled') { <div class="stamp">{{ 'status.Cancelled' | t }}</div> }
        <div class="inv-head">
          <div>
            @if (s.hasLogo) { <img class="inv-logo" [src]="api.logoUrl + '?v=' + s.logoUpdatedAt" alt="" /> }
            <h5 class="mb-1">{{ businessName() }}</h5>
            <div class="text-muted small">
              @if (s.address) { <div>{{ s.address }}</div> }
              @if (s.phone) { <div><span dir="ltr">{{ s.phone }}</span></div> }
              @if (s.email) { <div>{{ s.email }}</div> }
              @if (s.taxNumber) { <div>{{ 'inv.taxId' | t }}: {{ s.taxNumber }}</div> }
            </div>
          </div>
          <div class="text-end">
            <div class="inv-title">{{ 'inv.invoice' | t }}</div>
            <div class="mono fw-semibold fs-5">{{ i.invoiceNumber }}</div>
            <div class="text-muted small">{{ i.date | ldate: 'datetime' }}</div>
          </div>
        </div>

        <div class="inv-meta">
          <div>
            <div class="inv-label">{{ 'inv.billTo' | t }}</div>
            <div class="fw-semibold">{{ i.customerName || ('common.walkIn' | t) }}</div>
            @if (i.customerAddress) { <div class="small text-muted">{{ i.customerAddress }}</div> }
            @if (i.customerPhone) { <div class="small text-muted"><span dir="ltr">{{ i.customerPhone }}</span></div> }
            @if (i.customerTaxNumber) { <div class="small text-muted">{{ 'inv.taxId' | t }}: {{ i.customerTaxNumber }}</div> }
          </div>
          <div>
            <div class="inv-label">{{ 'inv.payment' | t }}</div><div class="mb-2">{{ 'pay.' + i.paymentMethod | t }}</div>
            <div class="inv-label">{{ 'inv.issuedBy' | t }}</div><div>{{ i.createdBy }}</div>
          </div>
        </div>

        <div class="table-responsive"><table class="table table-x mb-4">
          <thead><tr><th>#</th><th>{{ 'inv.product' | t }}</th><th class="text-end-x">{{ 'inv.unitPrice' | t }}</th><th class="text-end-x">{{ 'common.quantity' | t }}</th><th class="text-end-x">{{ 'inv.discount' | t }}</th><th class="text-end-x">{{ 'inv.lineTotal' | t }}</th></tr></thead>
          <tbody>
            @for (it of i.items; track it.id; let n = $index) {
              <tr><td>{{ n + 1 }}</td><td><strong>{{ it.productName }}</strong><small class="d-block text-muted mono">{{ it.sku }}</small></td>
                <td class="text-end-x">{{ it.unitPrice | money: i.currencySymbol }}</td><td class="text-end-x">{{ it.quantity | num }}</td>
                <td class="text-end-x">{{ it.discountPercent ? (it.discountPercent | num) + '%' : '—' }}</td>
                <td class="text-end-x fw-semibold">{{ it.lineTotal | money: i.currencySymbol }}</td></tr>
            }
          </tbody></table></div>

        <div class="inv-totals">
          <div class="totals-row"><span class="text-muted">{{ 'inv.subtotal' | t }}</span><span>{{ i.subtotal | money: i.currencySymbol }}</span></div>
          @if (i.discountAmount > 0) {
            <div class="totals-row"><span class="text-muted">{{ 'inv.discountAmount' | t }}@if (i.discountType === 'Percent') { ({{ i.discountValue | num }}%) }</span><span>-{{ i.discountAmount | money: i.currencySymbol }}</span></div>
          }
          <div class="totals-row"><span class="text-muted">{{ 'inv.tax' | t: { rate: i.taxRate } }}</span><span>{{ i.taxAmount | money: i.currencySymbol }}</span></div>
          <div class="totals-row grand"><span>{{ 'inv.grandTotal' | t }}</span><span>{{ i.total | money: i.currencySymbol }}</span></div>
        </div>

        @if (i.notes) { <div class="mt-4"><div class="inv-label">{{ 'common.notes' | t }}</div><div class="small">{{ i.notes }}</div></div> }
        @if (s.invoiceFooter) { <div class="text-center text-muted small mt-5 pt-3 border-top">{{ s.invoiceFooter }}</div> }
      </div>
    }

    @if (cancelOpen()) {
      <app-modal [title]="'inv.cancelTitle' | t: { number: inv()!.invoiceNumber }" (closed)="cancelOpen.set(false)">
        <div class="modal-body">
          <div class="alert alert-warning d-flex gap-2"><i class="bi bi-exclamation-triangle-fill"></i><div>{{ 'inv.cancelText' | t }}</div></div>
          <label class="form-label">{{ 'inv.cancelReasonLabel' | t }} ({{ 'common.optional' | t }})</label>
          <textarea rows="2" class="form-control" maxlength="500" [(ngModel)]="reason"></textarea>
        </div>
        <div class="modal-footer">
          <button class="btn btn-light" (click)="cancelOpen.set(false)">{{ 'common.close' | t }}</button>
          <button class="btn btn-danger" [disabled]="busy()" (click)="doCancel()">{{ 'inv.cancelConfirm' | t }}</button>
        </div>
      </app-modal>
    }
  `
})
export class InvoiceDetailComponent implements OnInit {
  api = inject(ApiService);
  auth = inject(AuthService);
  i18n = inject(I18nService);
  private toast = inject(ToastService);
  id = input.required<string>();
  inv = signal<InvoiceDetail | null>(null);
  settings = signal<Settings | null>(null);
  cancelOpen = signal(false);
  busy = signal(false);
  reason = '';

  ngOnInit() {
    this.api.invoice(+this.id()).subscribe({ next: (i) => this.inv.set(i), error: (e) => this.toast.httpError(e) });
    this.api.settings().subscribe((s) => this.settings.set(s));
  }
  businessName() {
    const s = this.settings();
    return this.i18n.lang() === 'ar' && s?.businessNameAr ? s.businessNameAr : s?.businessName;
  }
  print() { window.print(); }
  doCancel() {
    this.busy.set(true);
    this.api.cancelInvoice(+this.id(), this.reason || null).subscribe({
      next: (i) => { this.busy.set(false); this.inv.set(i); this.cancelOpen.set(false); this.toast.success('inv.cancelledOk'); },
      error: (e) => { this.busy.set(false); this.toast.httpError(e); }
    });
  }
}
