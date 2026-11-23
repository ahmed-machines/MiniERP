import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { ConfirmService } from '../core/confirm.service';
import { MoneyPipe, NumberPipe, TranslatePipe } from '../core/i18n/pipes';
import { Customer, PagedResult } from '../core/models';
import { ToastService } from '../core/toast.service';
import { ErrComponent, ModalComponent, PaginationComponent } from '../shared/components';

/** Shared create/edit modal, also used by the customer detail page. */
@Component({
  selector: 'app-customer-form',
  imports: [ReactiveFormsModule, TranslatePipe, ModalComponent, ErrComponent],
  template: `
    <app-modal [title]="(customer() ? 'cust.edit' : 'cust.new') | t" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="modal-body"><div class="row g-3">
          <div class="col-12"><label class="form-label">{{ 'common.name' | t }} *</label><input class="form-control" formControlName="name" /><app-err [c]="form.controls.name" /></div>
          <div class="col-md-6"><label class="form-label">{{ 'common.email' | t }}</label><input class="form-control" type="email" formControlName="email" /><app-err [c]="form.controls.email" /></div>
          <div class="col-md-6"><label class="form-label">{{ 'common.phone' | t }}</label><input class="form-control" formControlName="phone" dir="ltr" /><app-err [c]="form.controls.phone" /></div>
          <div class="col-md-8"><label class="form-label">{{ 'common.address' | t }}</label><input class="form-control" formControlName="address" /><app-err [c]="form.controls.address" /></div>
          <div class="col-md-4"><label class="form-label">{{ 'cust.taxNumber' | t }}</label><input class="form-control" formControlName="taxNumber" /><app-err [c]="form.controls.taxNumber" /></div>
          <div class="col-12"><label class="form-label">{{ 'common.notes' | t }}</label><textarea rows="2" class="form-control" formControlName="notes"></textarea><app-err [c]="form.controls.notes" /></div>
        </div></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-light" (click)="closed.emit()">{{ 'common.cancel' | t }}</button>
          <button class="btn btn-primary" [disabled]="saving()">{{ (saving() ? 'common.saving' : 'common.save') | t }}</button>
        </div>
      </form>
    </app-modal>
  `
})
export class CustomerFormComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  customer = input<Customer | null>(null);
  closed = output<void>();
  saved = output<Customer>();
  saving = signal(false);
  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    email: ['', [Validators.email, Validators.maxLength(200)]],
    phone: ['', Validators.maxLength(50)],
    address: ['', Validators.maxLength(500)],
    taxNumber: ['', Validators.maxLength(50)],
    notes: ['', Validators.maxLength(1000)]
  });

  ngOnInit() {
    const c = this.customer();
    if (c) this.form.patchValue({ name: c.name, email: c.email ?? '', phone: c.phone ?? '', address: c.address ?? '', taxNumber: c.taxNumber ?? '', notes: c.notes ?? '' });
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const body = { name: v.name, email: v.email || null, phone: v.phone || null, address: v.address || null, taxNumber: v.taxNumber || null, notes: v.notes || null };
    const c = this.customer();
    this.saving.set(true);
    (c ? this.api.updateCustomer(c.id, body) : this.api.createCustomer(body)).subscribe({
      next: (r) => { this.saving.set(false); this.toast.success('cust.saved'); this.saved.emit(r); },
      error: (e) => { this.saving.set(false); this.toast.httpError(e); }
    });
  }
}

@Component({
  selector: 'app-customers',
  imports: [FormsModule, RouterLink, TranslatePipe, MoneyPipe, NumberPipe, PaginationComponent, CustomerFormComponent],
  template: `
    <div class="page-header">
      <div><h1>{{ 'cust.title' | t }}</h1><p>{{ 'cust.subtitle' | t }}</p></div>
      <button class="btn btn-primary" (click)="open(null)"><i class="bi bi-plus-lg me-1"></i>{{ 'cust.new' | t }}</button>
    </div>
    <div class="card-x">
      <div class="filters">
        <div class="input-group search"><span class="input-group-text"><i class="bi bi-search"></i></span>
          <input class="form-control" [placeholder]="'cust.searchPlaceholder' | t" [ngModel]="search()" (ngModelChange)="onSearch($event)" /></div>
      </div>
      <div class="table-responsive"><table class="table table-x">
        <thead><tr><th>{{ 'common.name' | t }}</th><th>{{ 'common.email' | t }}</th><th>{{ 'common.phone' | t }}</th><th class="text-end-x">{{ 'cust.invoices' | t }}</th><th class="text-end-x">{{ 'cust.totalPurchases' | t }}</th><th class="text-end-x">{{ 'common.actions' | t }}</th></tr></thead>
        <tbody>
          @if (loading()) { <tr><td colspan="6"><div class="spinner-wrap py-4"><div class="spinner-border spinner-border-sm text-primary"></div></div></td></tr> }
          @else {
            @for (c of data().items; track c.id) {
              <tr>
                <td><a [routerLink]="['/customers', c.id]" class="fw-semibold text-decoration-none">{{ c.name }}</a></td>
                <td>{{ c.email }}</td>
                <td>@if (c.phone) { <span dir="ltr">{{ c.phone }}</span> }</td>
                <td class="text-end-x">{{ c.invoiceCount | num }}</td>
                <td class="text-end-x fw-semibold">{{ c.totalPurchases | money }}</td>
                <td class="text-end-x text-nowrap">
                  <a class="btn btn-light btn-icon" [routerLink]="['/customers', c.id]" [title]="'common.view' | t"><i class="bi bi-eye"></i></a>
                  <button class="btn btn-light btn-icon ms-1" [title]="'common.edit' | t" (click)="open(c)"><i class="bi bi-pencil"></i></button>
                  @if (auth.isAdmin()) { <button class="btn btn-light btn-icon ms-1 text-danger" [title]="'common.delete' | t" (click)="remove(c)"><i class="bi bi-trash"></i></button> }
                </td>
              </tr>
            } @empty { <tr><td colspan="6"><div class="empty"><i class="bi bi-people"></i>{{ 'common.noData' | t }}</div></td></tr> }
          }
        </tbody></table></div>
      <app-pagination [page]="page()" [pageSize]="pageSize" [total]="data().total" (pageChange)="page.set($event); load()" />
    </div>
    @if (formOpen()) { <app-customer-form [customer]="editing()" (closed)="formOpen.set(false)" (saved)="formOpen.set(false); load()" /> }
  `
})
export class CustomersComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  auth = inject(AuthService);
  pageSize = 10;
  data = signal<PagedResult<Customer>>({ items: [], total: 0, page: 1, pageSize: 10 });
  loading = signal(true);
  search = signal(''); page = signal(1);
  formOpen = signal(false); editing = signal<Customer | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  ngOnInit() { this.load(); }
  load() {
    this.loading.set(true);
    this.api.customers({ search: this.search(), page: this.page(), pageSize: this.pageSize })
      .subscribe({ next: (d) => { this.data.set(d); this.loading.set(false); }, error: (e) => { this.loading.set(false); this.toast.httpError(e); } });
  }
  onSearch(v: string) { this.search.set(v); this.page.set(1); clearTimeout(this.timer); this.timer = setTimeout(() => this.load(), 300); }
  open(c: Customer | null) { this.editing.set(c); this.formOpen.set(true); }
  async remove(c: Customer) {
    if (!(await this.confirm.ask({ messageKey: 'cust.deleteConfirm', params: { name: c.name }, confirmKey: 'common.delete' }))) return;
    this.api.deleteCustomer(c.id).subscribe({ next: () => { this.toast.success('cust.deleted'); this.load(); }, error: (e) => this.toast.httpError(e) });
  }
}
