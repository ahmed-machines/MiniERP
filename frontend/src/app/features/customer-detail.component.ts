import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { I18nService } from '../core/i18n/i18n.service';
import { LocalDatePipe, MoneyPipe, NumberPipe, TranslatePipe } from '../core/i18n/pipes';
import { CustomerDetail } from '../core/models';
import { ToastService } from '../core/toast.service';
import { CustomerFormComponent } from './customers.component';

@Component({
  selector: 'app-customer-detail',
  imports: [RouterLink, TranslatePipe, MoneyPipe, NumberPipe, LocalDatePipe, CustomerFormComponent],
  template: `
    <a routerLink="/customers" class="text-decoration-none small"><i class="bi me-1" [class.bi-arrow-left]="!i18n.isRtl()" [class.bi-arrow-right]="i18n.isRtl()"></i>{{ 'common.back' | t }}</a>
    @if (!d()) { <div class="spinner-wrap"><div class="spinner-border text-primary"></div></div> }
    @else {
      @let c = d()!.customer;
      <div class="page-header mt-2">
        <div class="d-flex align-items-center gap-3">
          <span class="avatar" style="width:56px;height:56px;font-size:1.1rem">{{ c.name.slice(0, 2).toUpperCase() }}</span>
          <div><h1>{{ c.name }}</h1><p>{{ 'cust.since' | t: { date: (c.createdAt | ldate) } }}</p></div>
        </div>
        <div class="d-flex gap-2">
          <a class="btn btn-light" [routerLink]="['/invoices/new']" [queryParams]="{ customerId: c.id }"><i class="bi bi-receipt me-1"></i>{{ 'cust.createInvoice' | t }}</a>
          <button class="btn btn-primary" (click)="edit.set(true)"><i class="bi bi-pencil me-1"></i>{{ 'common.edit' | t }}</button>
        </div>
      </div>
      <div class="row g-3">
        <div class="col-lg-4">
          <div class="card-x mb-3"><div class="card-x-header"><h6>{{ 'cust.details' | t }}</h6></div>
            <div class="card-x-body">
              <dl class="mb-0">
                <dt class="text-muted small">{{ 'common.email' | t }}</dt><dd>{{ c.email || '—' }}</dd>
                <dt class="text-muted small">{{ 'common.phone' | t }}</dt><dd>@if (c.phone) { <span dir="ltr">{{ c.phone }}</span> } @else { — }</dd>
                <dt class="text-muted small">{{ 'common.address' | t }}</dt><dd>{{ c.address || '—' }}</dd>
                <dt class="text-muted small">{{ 'cust.taxNumber' | t }}</dt><dd>{{ c.taxNumber || '—' }}</dd>
                <dt class="text-muted small">{{ 'common.notes' | t }}</dt><dd class="mb-0">{{ c.notes || '—' }}</dd>
              </dl>
            </div></div>
          <div class="row g-3">
            <div class="col-6"><div class="card-x card-x-body text-center"><div class="text-muted small">{{ 'cust.invoices' | t }}</div><div class="fs-4 fw-bold">{{ c.invoiceCount | num }}</div></div></div>
            <div class="col-6"><div class="card-x card-x-body text-center"><div class="text-muted small">{{ 'cust.totalPurchases' | t }}</div><div class="fs-5 fw-bold">{{ c.totalPurchases | money }}</div></div></div>
          </div>
        </div>
        <div class="col-lg-8"><div class="card-x">
          <div class="card-x-header"><h6>{{ 'cust.history' | t }}</h6></div>
          <div class="table-responsive"><table class="table table-x">
            <thead><tr><th>{{ 'inv.number' | t }}</th><th>{{ 'common.date' | t }}</th><th>{{ 'inv.payment' | t }}</th><th>{{ 'common.status' | t }}</th><th class="text-end-x">{{ 'common.total' | t }}</th></tr></thead>
            <tbody>
              @for (i of d()!.invoices; track i.id) {
                <tr><td><a [routerLink]="['/invoices', i.id]" class="fw-semibold text-decoration-none">{{ i.invoiceNumber }}</a></td>
                  <td>{{ i.date | ldate: 'datetime' }}</td><td>{{ 'pay.' + i.paymentMethod | t }}</td>
                  <td><span class="badge" [class]="i.status === 'Paid' ? 'b-soft-success' : 'b-soft-danger'">{{ 'status.' + i.status | t }}</span></td>
                  <td class="text-end-x fw-semibold">{{ i.total | money: i.currencySymbol }}</td></tr>
              } @empty { <tr><td colspan="5"><div class="empty"><i class="bi bi-receipt"></i>{{ 'cust.noInvoices' | t }}</div></td></tr> }
            </tbody></table></div>
        </div></div>
      </div>
      @if (edit()) { <app-customer-form [customer]="c" (closed)="edit.set(false)" (saved)="edit.set(false); load()" /> }
    }
  `
})
export class CustomerDetailComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  i18n = inject(I18nService);
  id = input.required<string>();
  d = signal<CustomerDetail | null>(null);
  edit = signal(false);
  ngOnInit() { this.load(); }
  load() { this.api.customer(+this.id()).subscribe({ next: (d) => this.d.set(d), error: (e) => this.toast.httpError(e) }); }
}
