import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token;
  const isApi = req.url.startsWith(environment.apiUrl);
  const authed = token && isApi ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(authed).pipe(
    catchError((e: HttpErrorResponse) => {
      // Expired/invalid token on a protected call -> back to login (but not for the login call itself).
      if (e.status === 401 && isApi && !req.url.endsWith('/auth/login') && auth.user()) {
        auth.logout(false);
        router.navigate(['/login'], { queryParams: { expired: 1 } });
      }
      return throwError(() => e);
    })
  );
};
