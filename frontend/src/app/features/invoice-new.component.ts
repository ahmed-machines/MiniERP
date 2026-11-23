import { Component, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { MoneyPipe, NumberPipe, TranslatePipe } from '../core/i18n/pipes';
import { Customer, DiscountType, InvoiceCreate, InvoicePreview, PaymentMethod, Product } from '../core/models';
import { ToastService } from '../core/toast.service';
import { CustomerFormComponent } from './customers.component';

interface Line { product: Product; quantity: number; discountPercent: number; }

@Component({
  selector: 'app-invoice-new',
  imports: [FormsModule, RouterLink, TranslatePipe, MoneyPipe, NumberPipe, CustomerFormComponent],
  template: `
    <div class="page-header">
      <div><h1>{{ 'inv.new' | t }}</h1></div>
      <a routerLink="/invoices" class="btn btn-light">{{ 'common.cancel' | t }}</a>
    </div>
    <div class="row g-3">
      <!-- Product picker -->
      <div class="col-xl-4 order-xl-1">
        <div class="card-x">
          <div class="card-x-header"><h6>{{ 'inv.addProduct' | t }}</h6></div>
          <div class="p-3 border-bottom"><div class="input-group"><span class="input-group-text"><i class="bi bi-search"></i></span>
            <input class="form-control" [placeholder]="'inv.searchProduct' | t" [ngModel]="q()" (ngModelChange)="onQ($event)" /></div></div>
          <div class="pick-list">
            @for (p of results(); track p.id) {
              <button type="button" class="pick" [disabled]="p.stockQuantity === 0 || inCart(p.id)" (click)="add(p)">
                <span><strong class="d-block">{{ p.name }}</strong><small class="text-muted mono">{{ p.sku }}</small></span>
                <span class="text-end"><strong class="d-block">{{ p.price | money }}</strong>
                  <small [class.text-danger]="p.stockQuantity === 0" [class.text-muted]="p.stockQuantity > 0">{{ (p.stockQuantity === 0 ? 'inv.outOfStock' : 'inv.available') | t: { n: p.stockQuantity } }}</small></span>
              </button>
            } @empty { <div class="empty py-4">{{ 'common.noData' | t }}</div> }
          </div>
        </div>
      </div>

      <!-- Lines -->
      <div class="col-xl-5 order-xl-2">
        <div class="card-x">
          <div class="card-x-header"><h6>{{ 'inv.items' | t }}</h6><span class="badge b-soft-primary">{{ lines().length }}</span></div>
          <div class="table-responsive"><table class="table table-x">
            <thead><tr><th>{{ 'inv.product' | t }}</th><th>{{ 'common.quantity' | t }}</th><th>{{ 'inv.discount' | t }}</th><th class="text-end-x">{{ 'inv.lineTotal' | t }}</th><th></th></tr></thead>
            <tbody>
              @for (l of lines(); track l.product.id; let idx = $index) {
                <tr>
                  <td><strong>{{ l.product.name }}</strong><small class="d-block text-muted">{{ l.product.price | money }} × {{ l.quantity | num }}</small></td>
                  <td>
                    <input type="number" min="1" class="form-control form-control-sm qty-input" [class.is-invalid]="l.quantity > l.product.stockQuantity || l.quantity < 1"
                      [ngModel]="l.quantity" (ngModelChange)="setQty(idx, $event)" />
                    @if (l.quantity > l.product.stockQuantity) { <div class="invalid-feedback d-block">{{ 'inv.maxQty' | t: { n: l.product.stockQuantity } }}</div> }
                  </td>
                  <td><input type="number" min="0" max="100" class="form-control form-control-sm pct-input" [ngModel]="l.discountPercent" (ngModelChange)="setDisc(idx, $event)" /></td>
                  <td class="text-end-x fw-semibold">{{ lineTotal(idx) | money }}</td>
                  <td class="text-end-x"><button class="btn btn-sm btn-light text-danger btn-icon" (click)="remove(idx)"><i class="bi bi-x-lg"></i></button></td>
                </tr>
              } @empty { <tr><td colspan="5"><div class="empty"><i class="bi bi-cart3"></i>{{ 'inv.noItems' | t }}</div></td></tr> }
            </tbody></table></div>
        </div>
      </div>

      <!-- Summary -->
      <div class="col-xl-3 order-xl-3">
        <div class="card-x">
          <div class="card-x-header"><h6>{{ 'inv.summary' | t }}</h6></div>
          <div class="card-x-body">
            <label class="form-label">{{ 'inv.customer' | t }}</label>
            <div class="input-group mb-3">
              <select class="form-select" [ngModel]="customerId()" (ngModelChange)="customerId.set($event)">
                <option [ngValue]="null">{{ 'common.walkIn' | t }}</option>
                @for (c of customers(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
              </select>
              <button type="button" class="btn btn-light" (click)="newCust.set(true)" [title]="'cust.new' | t"><i class="bi bi-person-plus"></i></button>
            </div>
            <label class="form-label">{{ 'inv.payment' | t }}</label>
            <select class="form-select mb-3" [ngModel]="payment()" (ngModelChange)="payment.set($event)">
              <option value="Cash">{{ 'pay.Cash' | t }}</option><option value="Card">{{ 'pay.Card' | t }}</option><option value="Transfer">{{ 'pay.Transfer' | t }}</option>
            </select>
            <label class="form-label">{{ 'inv.invoiceDiscount' | t }}</label>
            <div class="input-group mb-3">
              <select class="form-select" style="max-width:150px" [ngModel]="discType()" (ngModelChange)="discType.set($event)">
                <option value="None">{{ 'disc.None' | t }}</option><option value="Percent">{{ 'disc.Percent' | t }}</option><option value="Fixed">{{ 'disc.Fixed' | t }}</option>
              </select>
              <input type="number" min="0" class="form-control" [disabled]="discType() === 'None'" [ngModel]="discValue()" (ngModelChange)="discValue.set($event || 0)" />
            </div>
            <label class="form-label">{{ 'common.notes' | t }}</label>
            <textarea rows="2" class="form-control mb-3" maxlength="1000" [ngModel]="notes()" (ngModelChange)="notes.set($event)"></textarea>
            <hr />
            @let p = preview();
            <div class="totals-row"><span class="text-muted">{{ 'inv.subtotal' | t }}</span><span>{{ (p?.subtotal ?? 0) | money }}</span></div>
            <div class="totals-row"><span class="text-muted">{{ 'inv.discountAmount' | t }}</span><span class="text-danger">-{{ (p?.discountAmount ?? 0) | money }}</span></div>
            <div class="totals-row"><span class="text-muted">{{ 'inv.tax' | t: { rate: p?.taxRate ?? 0 } }}</span><span>{{ (p?.taxAmount ?? 0) | money }}</span></div>
            <div class="totals-row grand"><span>{{ 'inv.grandTotal' | t }}</span><span>{{ (p?.total ?? 0) | money }}</span></div>
            <button class="btn btn-primary w-100 mt-3 py-2" [disabled]="!canSubmit()" (click)="submit()">
              @if (saving()) { <span class="spinner-border spinner-border-sm me-2"></span>{{ 'inv.creating' | t }} } @else { <i class="bi bi-check2-circle me-1"></i>{{ 'inv.create' | t }} }
            </button>
          </div>
        </div>
      </div>
    </div>
    @if (newCust()) { <app-customer-form (closed)="newCust.set(false)" (saved)="onNewCustomer($event)" /> }
  `
})
export class InvoiceNewComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  customerIdParam = input<string>('', { alias: 'customerId' });
  q = signal('');
  results = signal<Product[]>([]);
  customers = signal<Customer[]>([]);
  lines = signal<Line[]>([]);
  customerId = signal<number | null>(null);
  payment = signal<PaymentMethod>('Cash');
  discType = signal<DiscountType>('None');
  discValue = signal(0);
  notes = signal('');
  preview = signal<InvoicePreview | null>(null);
  saving = signal(false);
  newCust = signal(false);
  private timer?: ReturnType<typeof setTimeout>;

  canSubmit = computed(() => !this.saving() && this.lines().length > 0 &&
    this.lines().every((l) => l.quantity >= 1 && l.quantity <= l.product.stockQuantity && l.discountPercent >= 0 && l.discountPercent <= 100) &&
    !(this.discType() === 'Percent' && this.discValue() > 100));

  constructor() {
    // The server owns the money maths: whenever the cart changes, ask it for a fresh preview (debounced).
    effect(() => {
      const body = this.body();
      clearTimeout(this.previewTimer);
      if (!body.items.length) { this.preview.set(null); return; }
      this.previewTimer = setTimeout(() => this.api.previewInvoice(body).subscribe({ next: (p) => this.preview.set(p), error: () => {} }), 250);
    });
  }
  private previewTimer?: ReturnType<typeof setTimeout>;

  ngOnInit() {
    this.search('');
    this.api.customers({ pageSize: 100 }).subscribe((r) => {
      this.customers.set(r.items);
      if (this.customerIdParam()) this.customerId.set(+this.customerIdParam());
    });
  }

  body = computed<InvoiceCreate>(() => ({
    customerId: this.customerId(), paymentMethod: this.payment(), discountType: this.discType(),
    discountValue: this.discType() === 'None' ? 0 : +this.discValue() || 0, notes: this.notes() || null,
    items: this.lines().map((l) => ({ productId: l.product.id, quantity: +l.quantity || 0, discountPercent: +l.discountPercent || 0 }))
  }));

  onQ(v: string) { this.q.set(v); clearTimeout(this.timer); this.timer = setTimeout(() => this.search(v), 250); }
  private search(v: string) { this.api.products({ search: v, status: 'active', pageSize: 30 }).subscribe((r) => this.results.set(r.items)); }
  inCart(id: number) { return this.lines().some((l) => l.product.id === id); }
  add(p: Product) { if (!this.inCart(p.id)) { this.preview.set(null); this.lines.update((ls) => [...ls, { product: p, quantity: 1, discountPercent: 0 }]); } }
  remove(i: number) { this.preview.set(null); this.lines.update((ls) => ls.filter((_, x) => x !== i)); }
  setQty(i: number, v: number) { this.lines.update((ls) => ls.map((l, x) => (x === i ? { ...l, quantity: Math.floor(+v) } : l))); }
  setDisc(i: number, v: number) { this.lines.update((ls) => ls.map((l, x) => (x === i ? { ...l, discountPercent: +v } : l))); }
  lineTotal(i: number) {
    const p = this.preview();
    if (p && p.lineTotals.length === this.lines().length) return p.lineTotals[i];
    const l = this.lines()[i];
    return l.product.price * l.quantity * (1 - (l.discountPercent || 0) / 100);
  }

  onNewCustomer(c: Customer) {
    this.newCust.set(false);
    this.customers.update((cs) => [...cs, c].sort((a, b) => a.name.localeCompare(b.name)));
    this.customerId.set(c.id);
  }

  submit() {
    if (!this.canSubmit()) return;
    this.saving.set(true);
    this.api.createInvoice(this.body()).subscribe({
      next: (inv) => { this.toast.success('inv.created', { number: inv.invoiceNumber }); this.router.navigate(['/invoices', inv.id]); },
      error: (e) => { this.saving.set(false); this.toast.httpError(e); this.search(this.q()); }
    });
  }
}
