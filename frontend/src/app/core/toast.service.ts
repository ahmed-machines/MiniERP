import { Injectable, inject, signal } from '@angular/core';
import { I18nService } from './i18n/i18n.service';
import { ApiError } from './models';

export interface Toast { id: number; type: 'success' | 'danger' | 'warning' | 'info'; message: string; }

@Injectable({ providedIn: 'root' })
export class ToastService {
  private i18n = inject(I18nService);
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  show(type: Toast['type'], message: string, ms = 4500) {
    const id = ++this.seq;
    this.toasts.update((t) => [...t, { id, type, message }]);
    setTimeout(() => this.dismiss(id), ms);
  }
  success(key: string, params?: Record<string, unknown>) { this.show('success', this.i18n.t(key, params)); }
  error(message: string) { this.show('danger', message, 7000); }
  dismiss(id: number) { this.toasts.update((t) => t.filter((x) => x.id !== id)); }

  /** Translate a backend error ({code, args}) into the active language. */
  errorMessage(e: unknown): string {
    const err = (e as { error?: ApiError; status?: number })?.error as ApiError | undefined;
    const status = (e as { status?: number })?.status ?? 0;
    if (status === 0) return this.i18n.t('err.network');
    if (status === 429) return this.i18n.t('err.too_many');
    if (status === 403) return this.i18n.t('err.forbidden');
    if (status === 401 && !err?.code) return this.i18n.t('err.unauthorized');
    const code = err?.code ?? 'server_error';
    const key = `err.${code}`;
    const translated = this.i18n.t(key, err?.args as Record<string, unknown> | undefined);
    return translated === key ? this.i18n.t('err.server_error') : translated;
  }
  httpError(e: unknown) { this.error(this.errorMessage(e)); }
}
