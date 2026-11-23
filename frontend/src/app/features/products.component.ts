import { Component, inject, input, signal, OnInit, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { ConfirmService } from '../core/confirm.service';
import { LocalDatePipe, MoneyPipe, NumberPipe, TranslatePipe } from '../core/i18n/pipes';
import { PagedResult, Product, StockMovement } from '../core/models';
import { ToastService } from '../core/toast.service';
import { ErrComponent, ModalComponent, PaginationComponent } from '../shared/components';

@Component({
  selector: 'app-products',
  imports: [ReactiveFormsModule, FormsModule, TranslatePipe, MoneyPipe, NumberPipe, LocalDatePipe, ModalComponent, PaginationComponent, ErrComponent],
  template: `
    <div class="page-header">
      <div><h1>{{ 'prod.title' | t }}</h1><p>{{ 'prod.subtitle' | t }}</p></div>
      @if (auth.isAdmin()) { <button class="btn btn-primary" (click)="openForm()"><i class="bi bi-plus-lg me-1"></i>{{ 'prod.new' | t }}</button> }
    </div>

    <div class="card-x">
      <div class="filters">
        <div class="input-group search">
          <span class="input-group-text"><i class="bi bi-search"></i></span>
          <input class="form-control" [placeholder]="'prod.searchPlaceholder' | t" [ngModel]="search()" (ngModelChange)="onSearch($event)" />
        </div>
        <select class="form-select w-auto" [ngModel]="category()" (ngModelChange)="category.set($event); page.set(1); load()">
          <option value="">{{ 'prod.allCategories' | t }}</option>
          @for (c of categories(); track c) { <option [value]="c">{{ c }}</option> }
        </select>
        <select class="form-select w-auto" [ngModel]="status()" (ngModelChange)="status.set($event); page.set(1); load()">
          <option value="">{{ 'prod.filter.all' | t }}</option>
          <option value="active">{{ 'prod.filter.active' | t }}</option>
          <option value="inactive">{{ 'prod.filter.inactive' | t }}</option>
          <option value="low">{{ 'prod.filter.low' | t }}</option>
          <option value="out">{{ 'prod.filter.out' | t }}</option>
        </select>
      </div>

      <div class="table-responsive">
        <table class="table table-x">
          <thead><tr>
            <th class="sortable" (click)="sort('name')">{{ 'common.name' | t }} {{ arrow('name') }}</th>
            <th class="sortable" (click)="sort('sku')">{{ 'prod.sku' | t }} {{ arrow('sku') }}</th>
            <th class="sortable" (click)="sort('category')">{{ 'common.category' | t }} {{ arrow('category') }}</th>
            @if (auth.isAdmin()) { <th class="text-end-x">{{ 'prod.cost' | t }}</th> }
            <th class="text-end-x sortable" (click)="sort('price')">{{ 'common.price' | t }} {{ arrow('price') }}</th>
            <th class="text-end-x sortable" (click)="sort('stock')">{{ 'prod.stock' | t }} {{ arrow('stock') }}</th>
            <th>{{ 'common.status' | t }}</th>
            <th class="text-end-x">{{ 'common.actions' | t }}</th>
          </tr></thead>
          <tbody>
            @if (loading()) { <tr><td colspan="8"><div class="spinner-wrap py-4"><div class="spinner-border spinner-border-sm text-primary"></div></div></td></tr> }
            @else {
              @for (p of data().items; track p.id) {
                <tr>
                  <td class="fw-semibold">{{ p.name }}</td>
                  <td class="mono">{{ p.sku }}</td>
                  <td>{{ p.category }}</td>
                  @if (auth.isAdmin()) { <td class="text-end-x text-muted">{{ p.cost | money }}</td> }
                  <td class="text-end-x fw-semibold">{{ p.price | money }}</td>
                  <td class="text-end-x">
                    <span class="stock-pill" [class.text-danger]="p.stockQuantity === 0" [class.text-warning]="p.isLowStock && p.stockQuantity > 0">
                      {{ p.stockQuantity | num }}
                      @if (p.stockQuantity === 0) { <span class="badge b-soft-danger">{{ 'prod.outBadge' | t }}</span> }
                      @else if (p.isLowStock) { <span class="badge b-soft-warning">{{ 'prod.lowBadge' | t }}</span> }
                    </span>
                  </td>
                  <td><span class="badge" [class]="p.isActive ? 'b-soft-success' : 'b-soft-secondary'">{{ (p.isActive ? 'common.active' : 'common.inactive') | t }}</span></td>
                  <td class="text-end-x text-nowrap">
                    <button class="btn btn-light btn-icon" [title]="'prod.history' | t" (click)="openHistory(p)"><i class="bi bi-clock-history"></i></button>
                    @if (auth.isAdmin()) {
                      <button class="btn btn-light btn-icon ms-1" [title]="'prod.adjust' | t" (click)="openAdjust(p)"><i class="bi bi-arrow-down-up"></i></button>
                      <button class="btn btn-light btn-icon ms-1" [title]="'common.edit' | t" (click)="openForm(p)"><i class="bi bi-pencil"></i></button>
                      <button class="btn btn-light btn-icon ms-1 text-danger" [title]="'common.delete' | t" (click)="remove(p)"><i class="bi bi-trash"></i></button>
                    }
                  </td>
                </tr>
              } @empty { <tr><td colspan="8"><div class="empty"><i class="bi bi-box-seam"></i>{{ 'common.noData' | t }}</div></td></tr> }
            }
          </tbody>
        </table>
      </div>
      <app-pagination [page]="page()" [pageSize]="pageSize" [total]="data().total" (pageChange)="page.set($event); load()" />
    </div>

    @if (formOpen()) {
      <app-modal [title]="(editing() ? 'prod.edit' : 'prod.new') | t" size="lg" (closed)="formOpen.set(false)">
        <form [formGroup]="form" (ngSubmit)="save()" novalidate>
          <div class="modal-body"><div class="row g-3">
            <div class="col-md-8"><label class="form-label">{{ 'prod.name' | t }} *</label><input class="form-control" formControlName="name" /><app-err [c]="form.controls.name" /></div>
            <div class="col-md-4"><label class="form-label">{{ 'prod.sku' | t }} *</label><input class="form-control mono" formControlName="sku" /><app-err [c]="form.controls.sku" /></div>
            <div class="col-md-6"><label class="form-label">{{ 'common.category' | t }}</label><input class="form-control" formControlName="category" list="cat-list" />
              <datalist id="cat-list">@for (c of categories(); track c) { <option [value]="c"></option> }</datalist><app-err [c]="form.controls.category" /></div>
            <div class="col-md-3"><label class="form-label">{{ 'prod.cost' | t }}</label><input type="number" step="0.01" min="0" class="form-control" formControlName="cost" /><app-err [c]="form.controls.cost" /></div>
            <div class="col-md-3"><label class="form-label">{{ 'prod.price' | t }} *</label><input type="number" step="0.01" min="0" class="form-control" formControlName="price" /><app-err [c]="form.controls.price" /></div>
            <div class="col-md-4">
              <label class="form-label">{{ 'prod.stockInitial' | t }}</label>
              <input type="number" min="0" class="form-control" formControlName="stockQuantity" />
              @if (editing()) { <div class="form-text">{{ 'prod.stockEditHint' | t }}</div> }
              <app-err [c]="form.controls.stockQuantity" />
            </div>
            <div class="col-md-4"><label class="form-label">{{ 'prod.lowThreshold' | t }}</label><input type="number" min="0" class="form-control" formControlName="lowStockThreshold" /><app-err [c]="form.controls.lowStockThreshold" /></div>
            <div class="col-md-4 d-flex align-items-end"><div class="form-check form-switch mb-2"><input class="form-check-input" type="checkbox" id="pa" formControlName="isActive" /><label class="form-check-label" for="pa">{{ 'common.active' | t }}</label></div></div>
            <div class="col-12"><label class="form-label">{{ 'prod.description' | t }}</label><textarea rows="2" class="form-control" formControlName="description"></textarea><app-err [c]="form.controls.description" /></div>
          </div></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-light" (click)="formOpen.set(false)">{{ 'common.cancel' | t }}</button>
            <button class="btn btn-primary" [disabled]="saving()">{{ (saving() ? 'common.saving' : 'common.save') | t }}</button>
          </div>
        </form>
      </app-modal>
    }

    @if (adjusting(); as p) {
      <app-modal [title]="'prod.adjustTitle' | t: { name: p.name }" (closed)="adjusting.set(null)">
        <div class="modal-body">
          <div class="d-flex justify-content-between mb-3"><span class="text-muted">{{ 'prod.currentStock' | t }}</span><strong>{{ p.stockQuantity | num }}</strong></div>
          <label class="form-label">{{ 'prod.change' | t }}</label>
          <input type="number" class="form-control mb-1" [(ngModel)]="adjChange" />
          <div class="small mb-3" [class.text-danger]="p.stockQuantity + adjChange < 0">{{ 'prod.newBalance' | t }}: <strong>{{ p.stockQuantity + (adjChange || 0) | num }}</strong></div>
          <label class="form-label">{{ 'prod.note' | t }}</label>
          <input class="form-control" [(ngModel)]="adjNote" maxlength="500" />
        </div>
        <div class="modal-footer">
          <button class="btn btn-light" (click)="adjusting.set(null)">{{ 'common.cancel' | t }}</button>
          <button class="btn btn-primary" [disabled]="!adjChange || p.stockQuantity + adjChange < 0 || saving()" (click)="doAdjust(p)">{{ 'common.save' | t }}</button>
        </div>
      </app-modal>
    }

    @if (history(); as h) {
      <app-modal [title]="('prod.history' | t) + ' – ' + h.product.name" size="lg" (closed)="history.set(null)">
        <div class="modal-body p-0"><div class="table-responsive"><table class="table table-x">
          <thead><tr><th>{{ 'common.date' | t }}</th><th>{{ 'prod.type' | t }}</th><th class="text-end-x">{{ 'common.quantity' | t }}</th><th class="text-end-x">{{ 'prod.balance' | t }}</th><th>{{ 'prod.reference' | t }}</th></tr></thead>
          <tbody>
            @for (m of h.items; track m.id) {
              <tr><td>{{ m.createdAt | ldate: 'datetime' }}</td><td>{{ 'mov.' + m.type | t }}@if (m.note) { <small class="text-muted d-block">{{ m.note }}</small> }</td>
                <td class="text-end-x fw-semibold" [class.text-success]="m.quantityChange > 0" [class.text-danger]="m.quantityChange < 0"><span dir="ltr">{{ m.quantityChange > 0 ? '+' : '' }}{{ m.quantityChange }}</span></td>
                <td class="text-end-x">{{ m.balanceAfter | num }}</td><td class="mono">{{ m.reference }}</td></tr>
            } @empty { <tr><td colspan="5"><div class="empty">{{ 'common.noData' | t }}</div></td></tr> }
          </tbody></table></div></div>
      </app-modal>
    }
  `
})
export class ProductsComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  auth = inject(AuthService);

  /** Bound from the ?status= query param (e.g. dashboard "low stock" link). */
  statusParam = input<string>('', { alias: 'status' });

  pageSize = 10;
  data = signal<PagedResult<Product>>({ items: [], total: 0, page: 1, pageSize: 10 });
  loading = signal(true);
  categories = signal<string[]>([]);
  search = signal(''); category = signal(''); status = signal('');
  page = signal(1); sortBy = signal('name'); desc = signal(false);
  formOpen = signal(false); editing = signal<Product | null>(null); saving = signal(false);
  adjusting = signal<Product | null>(null); adjChange = 0; adjNote = '';
  history = signal<{ product: Product; items: StockMovement[] } | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    sku: ['', [Validators.required, Validators.maxLength(50)]],
    category: ['', Validators.maxLength(100)],
    description: ['', Validators.maxLength(2000)],
    price: [0, [Validators.required, Validators.min(0)]],
    cost: [0, [Validators.min(0)]],
    stockQuantity: [0, [Validators.required, Validators.min(0)]],
    lowStockThreshold: [10, [Validators.required, Validators.min(0)]],
    isActive: [true]
  });

  ngOnInit() {
    if (this.statusParam()) this.status.set(this.statusParam());
    this.api.categories().subscribe((c) => this.categories.set(c));
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.products({ search: this.search(), category: this.category(), status: this.status(), sortBy: this.sortBy(), desc: this.desc(), page: this.page(), pageSize: this.pageSize })
      .subscribe({ next: (d) => { this.data.set(d); this.loading.set(false); }, error: (e) => { this.loading.set(false); this.toast.httpError(e); } });
  }
  onSearch(v: string) { this.search.set(v); this.page.set(1); clearTimeout(this.timer); this.timer = setTimeout(() => this.load(), 300); }
  sort(col: string) { if (this.sortBy() === col) this.desc.update((d) => !d); else { this.sortBy.set(col); this.desc.set(false); } this.load(); }
  arrow(col: string) { return this.sortBy() === col ? (this.desc() ? '↓' : '↑') : ''; }

  openForm(p?: Product) {
    this.editing.set(p ?? null);
    this.form.reset({ name: p?.name ?? '', sku: p?.sku ?? '', category: p?.category ?? '', description: p?.description ?? '', price: p?.price ?? 0, cost: p?.cost ?? 0, stockQuantity: p?.stockQuantity ?? 0, lowStockThreshold: p?.lowStockThreshold ?? 10, isActive: p?.isActive ?? true });
    if (p) this.form.controls.stockQuantity.disable(); else this.form.controls.stockQuantity.enable();
    this.formOpen.set(true);
  }
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const body = { ...v, category: v.category || null, description: v.description || null };
    this.saving.set(true);
    const e = this.editing();
    const req = e ? this.api.updateProduct(e.id, body) : this.api.createProduct(body);
    req.subscribe({
      next: () => { this.saving.set(false); this.formOpen.set(false); this.toast.success('prod.saved'); this.load(); this.api.categories().subscribe((c) => this.categories.set(c)); },
      error: (err) => { this.saving.set(false); this.toast.httpError(err); }
    });
  }
  async remove(p: Product) {
    if (!(await this.confirm.ask({ messageKey: 'prod.deleteConfirm', params: { name: p.name }, confirmKey: 'common.delete' }))) return;
    this.api.deleteProduct(p.id).subscribe({ next: () => { this.toast.success('prod.deleted'); this.load(); }, error: (e) => this.toast.httpError(e) });
  }
  openAdjust(p: Product) { this.adjChange = 0; this.adjNote = ''; this.adjusting.set(p); }
  doAdjust(p: Product) {
    this.saving.set(true);
    this.api.adjustStock(p.id, this.adjChange, this.adjNote || null).subscribe({
      next: () => { this.saving.set(false); this.adjusting.set(null); this.toast.success('prod.adjusted'); this.load(); },
      error: (e) => { this.saving.set(false); this.toast.httpError(e); }
    });
  }
  openHistory(p: Product) { this.api.movements(p.id).subscribe({ next: (items) => this.history.set({ product: p, items }), error: (e) => this.toast.httpError(e) }); }
}
