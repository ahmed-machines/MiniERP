import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { ApiService } from './api.service';
import { Role, UserInfo } from './models';

const TOKEN_KEY = 'minierp.token';
const USER_KEY = 'minierp.user';
const EXP_KEY = 'minierp.exp';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private router = inject(Router);

  readonly user = signal<UserInfo | null>(this.load());
  readonly isLoggedIn = computed(() => !!this.user() && !!this.readValidToken());
  readonly isAdmin = computed(() => this.user()?.role === 'Admin');

  get token(): string | null {
    return this.readValidToken();
  }

  private readValidToken(): string | null {
    const t = localStorage.getItem(TOKEN_KEY);
    const exp = localStorage.getItem(EXP_KEY);
    if (!t || (exp && new Date(exp).getTime() < Date.now())) return null;
    return t;
  }

  login(username: string, password: string) {
    return this.api.login(username, password).pipe(
      tap((r) => {
        localStorage.setItem(TOKEN_KEY, r.token);
        localStorage.setItem(USER_KEY, JSON.stringify(r.user));
        localStorage.setItem(EXP_KEY, r.expiresAt.endsWith('Z') ? r.expiresAt : r.expiresAt + 'Z');
        this.user.set(r.user);
      })
    );
  }

  hasRole(...roles: Role[]) { const u = this.user(); return !!u && roles.includes(u.role); }

  logout(redirect = true) {
    this.clear();
    if (redirect) this.router.navigate(['/login']);
  }

  private clear() {
    localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); localStorage.removeItem(EXP_KEY);
    this.user.set(null);
  }

  private load(): UserInfo | null {
    if (!this.readValidToken()) {
      localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); localStorage.removeItem(EXP_KEY);
      return null;
    }
    try { return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null'); } catch { return null; }
  }
}
