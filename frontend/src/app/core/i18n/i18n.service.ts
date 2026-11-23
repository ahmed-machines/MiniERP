import { Injectable, computed, effect, signal } from '@angular/core';
import { EN } from './en';
import { AR } from './ar';

export type Lang = 'en' | 'ar';
const STORAGE_KEY = 'minierp.lang';
const DICTS: Record<Lang, Record<string, string>> = { en: EN, ar: AR };

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly lang = signal<Lang>(this.initial());
  readonly dir = computed(() => (this.lang() === 'ar' ? 'rtl' : 'ltr'));
  /** Currency symbol from system settings (set by the shell after loading settings). */
  readonly currency = signal('$');
  readonly isRtl = computed(() => this.lang() === 'ar');
  /** Western digits in Arabic (ar-u-nu-latn) keep numbers and prices consistent across both languages. */
  readonly locale = computed(() => (this.lang() === 'ar' ? 'ar-u-nu-latn' : 'en-US'));

  constructor() {
    effect(() => {
      const lang = this.lang();
      const rtl = lang === 'ar';
      const html = document.documentElement;
      html.lang = lang;
      html.dir = rtl ? 'rtl' : 'ltr';
      document.body.classList.toggle('rtl', rtl);
      // Bootstrap ships a dedicated RTL build; swap the stylesheet along with the direction.
      const link = document.getElementById('bootstrap-css') as HTMLLinkElement | null;
      const href = rtl ? 'vendor/bootstrap.rtl.min.css' : 'vendor/bootstrap.min.css';
      if (link && !link.href.endsWith(href)) link.href = href;
      document.title = this.t('app.title');
    });
  }

  setLang(l: Lang) {
    localStorage.setItem(STORAGE_KEY, l);
    this.lang.set(l);
  }
  toggle() { this.setLang(this.lang() === 'en' ? 'ar' : 'en'); }

  /** Translate a key, interpolating {placeholders}. Falls back to English, then to the key itself. */
  t(key: string, params?: Record<string, unknown>): string {
    let s = DICTS[this.lang()][key] ?? EN[key] ?? key;
    if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v ?? ''));
    return s;
  }

  private initial(): Lang {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'ar' || saved === 'en' ? saved : 'en';
  }
}
