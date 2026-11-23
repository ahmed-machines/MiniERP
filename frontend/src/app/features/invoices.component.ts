import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { LocalDatePipe, MoneyPipe, TranslatePipe } from '../core/i18n/pipes';
import { InvoiceSummary, PagedResult } from '../core/models';
import { ToastService } from '../core/toast.service';
import { PaginationComponent } from '../shared/components';

@Component({
  selector: 'app-invoices',
  imports: [FormsModule, RouterLink, TranslatePipe, MoneyPipe, LocalDatePipe, PaginationComponent],
  template: `
    <div class="page-header">
      <div><h1>{{ 'inv.title' | t }}</h1><p>{{ 'inv.subtitle' | t }}</p></div>
      <a class="btn btn-primary" routerLink="/invoices/new"><i class="bi bi-plus-lg me-1"></i>{{ 'inv.new' | t }}</a>
    </div>
    <div class="card-x">
      <div class="filters">
        <div class="input-group search"><span class="input-group-text"><i class="bi bi-search"></i></span>
          <input class="form-control" [placeholder]="'inv.searchPlaceholder' | t" [ngModel]="search()" (ngModelChange)="onSearch($event)" /></div>
        <select class="form-select w-auto" [ngModel]="status()" (ngModelChange)="status.set($event); page.set(1); load()">
          <option value="">{{ 'inv.status.all' | t }}</option>
          <option value="Paid">{{ 'status.Paid' | t }}</option>
          <option value="Cancelled">{{ 'status.Cancelled' | t }}</option>
        </select>
        <div class="input-group w-auto">
          <span class="input-group-text">{{ 'common.from' | t }}</span>
          <input type="date" class="form-control" [ngModel]="from()" (ngModelChange)="from.set($event); page.set(1); load()" />
          <span class="input-group-text">{{ 'common.to' | t }}</span>
          <input type="date" class="form-control" [ngModel]="to()" (ngModelChange)="to.set($event); page.set(1); load()" />
        </div>
        @if (search() || status() || from() || to()) { <button class="btn btn-light" (click)="clear()"><i class="bi bi-x-lg me-1"></i>{{ 'common.clear' | t }}</button> }
      </div>
      <div class="table-responsive"><table class="table table-x">
        <thead><tr><th>{{ 'inv.number' | t }}</th><th>{{ 'inv.customer' | t }}</th><th>{{ 'common.date' | t }}</th><th>{{ 'inv.payment' | t }}</th><th>{{ 'common.status' | t }}</th><th class="text-end-x">{{ 'common.total' | t }}</th><th class="text-end-x">{{ 'common.actions' | t }}</th></tr></thead>
        <tbody>
          @if (loading()) { <tr><td colspan="7"><div class="spinner-wrap py-4"><div class="spinner-border spinner-border-sm text-primary"></div></div></td></tr> }
          @else {
            @for (i of data().items; track i.id) {
              <tr>
                <td><a [routerLink]="['/invoices', i.id]" class="fw-semibold text-decoration-none mono">{{ i.invoiceNumber }}</a></td>
                <td>{{ i.customerName || ('common.walkIn' | t) }}</td>
                <td>{{ i.date | ldate: 'datetime' }}</td>
                <td>{{ 'pay.' + i.paymentMethod | t }}</td>
                <td><span class="badge" [class]="i.status === 'Paid' ? 'b-soft-success' : 'b-soft-danger'">{{ 'status.' + i.status | t }}</span></td>
                <td class="text-end-x fw-semibold" [class.text-decoration-line-through]="i.status === 'Cancelled'">{{ i.total | money: i.currencySymbol }}</td>
                <td class="text-end-x"><a class="btn btn-light btn-icon" [routerLink]="['/invoices', i.id]" [title]="'inv.viewInvoice' | t"><i class="bi bi-eye"></i></a></td>
              </tr>
            } @empty { <tr><td colspan="7"><div class="empty"><i class="bi bi-receipt"></i>{{ 'common.noData' | t }}</div></td></tr> }
          }
        </tbody></table></div>
      <app-pagination [page]="page()" [pageSize]="pageSize" [total]="data().total" (pageChange)="page.set($event); load()" />
    </div>
  `
})
export class InvoicesComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  pageSize = 10;
  data = signal<PagedResult<InvoiceSummary>>({ items: [], total: 0, page: 1, pageSize: 10 });
  loading = signal(true);
  search = signal(''); status = signal(''); from = signal(''); to = signal(''); page = signal(1);
  private timer?: ReturnType<typeof setTimeout>;

  ngOnInit() { this.load(); }
  load() {
    this.loading.set(true);
    // "to" is inclusive for the user, so send the start of the following day.
    const toExclusive = this.to() ? new Date(new Date(this.to()).getTime() + 86400000).toISOString().slice(0, 10) : '';
    this.api.invoices({ search: this.search(), status: this.status(), from: this.from(), to: toExclusive, page: this.page(), pageSize: this.pageSize })
      .subscribe({ next: (d) => { this.data.set(d); this.loading.set(false); }, error: (e) => { this.loading.set(false); this.toast.httpError(e); } });
  }
  onSearch(v: string) { this.search.set(v); this.page.set(1); clearTimeout(this.timer); this.timer = setTimeout(() => this.load(), 300); }
  clear() { this.search.set(''); this.status.set(''); this.from.set(''); this.to.set(''); this.page.set(1); this.load(); }
}
