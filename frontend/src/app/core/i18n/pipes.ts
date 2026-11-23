import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';

/** Impure on purpose so it re-evaluates when the language signal changes. */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private i18n = inject(I18nService);
  transform(key: string, params?: Record<string, unknown>): string {
    this.i18n.lang(); // register signal dependency
    return this.i18n.t(key, params);
  }
}

@Pipe({ name: 'money', pure: false })
export class MoneyPipe implements PipeTransform {
  private i18n = inject(I18nService);
  transform(value: number | null | undefined, symbolOverride?: string): string {
    const symbol = symbolOverride ?? this.i18n.currency();
    const n = new Intl.NumberFormat(this.i18n.locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0);
    return this.i18n.isRtl() ? `${n} ${symbol}` : `${symbol}${n}`;
  }
}

@Pipe({ name: 'ldate', pure: false })
export class LocalDatePipe implements PipeTransform {
  private i18n = inject(I18nService);
  transform(value: string | Date | null | undefined, mode: 'date' | 'datetime' | 'short' = 'date'): string {
    if (!value) return '';
    // The API returns UTC without a "Z"; make sure the browser treats it as UTC.
    const d = typeof value === 'string' ? new Date(/Z|[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z') : value;
    const opts: Intl.DateTimeFormatOptions =
      mode === 'datetime' ? { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
      : mode === 'short' ? { month: 'short', day: 'numeric' }
      : { year: 'numeric', month: 'short', day: 'numeric' };
    return new Intl.DateTimeFormat(this.i18n.locale(), opts).format(d);
  }
}

@Pipe({ name: 'num', pure: false })
export class NumberPipe implements PipeTransform {
  private i18n = inject(I18nService);
  transform(value: number | null | undefined): string {
    return new Intl.NumberFormat(this.i18n.locale()).format(value ?? 0);
  }
}
