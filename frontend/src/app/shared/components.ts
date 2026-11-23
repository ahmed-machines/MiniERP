import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '../core/i18n/pipes';
import { ToastService } from '../core/toast.service';
import { ConfirmService } from '../core/confirm.service';
import { AbstractControl } from '@angular/forms';
import { I18nService } from '../core/i18n/i18n.service';

/** Generic modal built on Bootstrap's modal CSS (no Bootstrap JS needed). */
@Component({
  selector: 'app-modal',
  imports: [TranslatePipe],
  template: `
    <div class="modal-backdrop fade show"></div>
    <div class="modal fade show d-block" tabindex="-1" role="dialog" aria-modal="true" (mousedown)="onBackdrop($event)">
      <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable" [class.modal-lg]="size() === 'lg'" [class.modal-xl]="size() === 'xl'">
        <div class="modal-content border-0 shadow-lg">
          <div class="modal-header">
            <h5 class="modal-title">{{ title() }}</h5>
            <button type="button" class="btn-close" [attr.aria-label]="'common.close' | t" (click)="closed.emit()"></button>
          </div>
          <ng-content />
        </div>
      </div>
    </div>
  `,
  host: { '(document:keydown.escape)': 'closed.emit()' }
})
export class ModalComponent {
  title = input.required<string>();
  size = input<'md' | 'lg' | 'xl'>('md');
  closed = output<void>();
  onBackdrop(e: MouseEvent) { if ((e.target as HTMLElement).classList.contains('modal')) this.closed.emit(); }
}

@Component({
  selector: 'app-pagination',
  imports: [TranslatePipe],
  template: `
    @if (total() > 0) {
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 px-3 py-3 border-top">
        <small class="text-muted">{{ 'common.showing' | t: { from: from(), to: to(), total: total() } }}</small>
        <nav>
          <ul class="pagination pagination-sm mb-0">
            <li class="page-item" [class.disabled]="page() <= 1"><button class="page-link" (click)="go(page() - 1)"><i class="bi" [class.bi-chevron-left]="!rtl()" [class.bi-chevron-right]="rtl()"></i></button></li>
            @for (p of pages(); track p) {
              <li class="page-item" [class.active]="p === page()"><button class="page-link" (click)="go(p)">{{ p }}</button></li>
            }
            <li class="page-item" [class.disabled]="page() >= totalPages()"><button class="page-link" (click)="go(page() + 1)"><i class="bi" [class.bi-chevron-right]="!rtl()" [class.bi-chevron-left]="rtl()"></i></button></li>
          </ul>
        </nav>
      </div>
    }
  `
})
export class PaginationComponent {
  private i18n = inject(I18nService);
  rtl = this.i18n.isRtl;
  page = input.required<number>();
  pageSize = input.required<number>();
  total = input.required<number>();
  pageChange = output<number>();
  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  from = computed(() => (this.page() - 1) * this.pageSize() + 1);
  to = computed(() => Math.min(this.page() * this.pageSize(), this.total()));
  pages = computed(() => {
    const t = this.totalPages(), c = this.page();
    const start = Math.max(1, Math.min(c - 2, t - 4)), end = Math.min(t, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  });
  go(p: number) { if (p >= 1 && p <= this.totalPages() && p !== this.page()) this.pageChange.emit(p); }
}

/** Shows a translated validation message for the first error of a control. */
@Component({
  selector: 'app-err',
  imports: [TranslatePipe],
  template: `@if (tick() >= 0 && c().invalid && (c().touched || c().dirty)) {<div class="invalid-feedback d-block">{{ msg() | t: args() }}</div>}`
})
export class ErrComponent {
  c = input.required<AbstractControl>();
  tick = signal(0);
  constructor() {
    effect((onCleanup) => {
      const sub = this.c().events.subscribe(() => this.tick.update((n) => n + 1));
      onCleanup(() => sub.unsubscribe());
    });
  }
  msg() {
    this.tick();
    const e = this.c().errors ?? {};
    if (e['required']) return 'val.required';
    if (e['email']) return 'val.email';
    if (e['maxlength']) return 'val.maxLength';
    if (e['minlength']) return 'val.minLength';
    if (e['min']) return 'val.min';
    if (e['max']) return 'val.max';
    if (e['pattern']) return 'val.pattern';
    return 'val.invalid';
  }
  args() {
    const e = this.c().errors ?? {};
    return { max: e['maxlength']?.requiredLength ?? e['max']?.max, min: e['minlength']?.requiredLength ?? e['min']?.min };
  }
}

@Component({
  selector: 'app-toasts',
  template: `
    <div class="toast-stack">
      @for (t of toasts.toasts(); track t.id) {
        <div class="app-toast" [class]="'app-toast t-' + t.type" role="alert" (click)="toasts.dismiss(t.id)">
          <i class="bi" [class]="t.type === 'success' ? 'bi-check-circle-fill' : t.type === 'danger' ? 'bi-exclamation-octagon-fill' : t.type === 'warning' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill'"></i>
          <span>{{ t.message }}</span>
        </div>
      }
    </div>
  `
})
export class ToastsComponent { toasts = inject(ToastService); }

@Component({
  selector: 'app-confirm',
  imports: [TranslatePipe],
  template: `
    @if (svc.current(); as c) {
      <div class="modal-backdrop fade show" style="z-index:1060"></div>
      <div class="modal fade show d-block" style="z-index:1065" tabindex="-1" role="alertdialog" aria-modal="true">
        <div class="modal-dialog modal-dialog-centered modal-sm">
          <div class="modal-content border-0 shadow-lg text-center p-3">
            <div class="confirm-icon mx-auto mb-3" [class.danger]="c.danger !== false"><i class="bi bi-exclamation-lg"></i></div>
            <h6 class="mb-2">{{ (c.titleKey ?? 'confirm.title') | t }}</h6>
            <p class="text-muted small mb-4">{{ c.message ?? ((c.messageKey ?? '') | t: c.params) }}</p>
            <div class="d-flex gap-2 justify-content-center">
              <button class="btn btn-light" (click)="svc.answer(false)">{{ 'common.cancel' | t }}</button>
              <button class="btn" [class.btn-danger]="c.danger !== false" [class.btn-primary]="c.danger === false" (click)="svc.answer(true)">{{ (c.confirmKey ?? 'common.confirm') | t }}</button>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class ConfirmHostComponent { svc = inject(ConfirmService); }
