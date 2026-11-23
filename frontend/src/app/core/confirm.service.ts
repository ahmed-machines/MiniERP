import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions { messageKey?: string; message?: string; params?: Record<string, unknown>; titleKey?: string; confirmKey?: string; danger?: boolean; }

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly current = signal<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  ask(opts: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => this.current.set({ ...opts, resolve }));
  }
  answer(v: boolean) {
    const c = this.current();
    this.current.set(null);
    c?.resolve(v);
  }
}
