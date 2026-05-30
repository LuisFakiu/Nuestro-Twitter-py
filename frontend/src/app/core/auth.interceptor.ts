import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { catchError, switchMap, throwError } from 'rxjs';

let isRefreshing = false;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  if (req.url.includes('/auth/refresh/')) {
    return next(req);
  }

  const token = auth.getAccessToken();
  if (!token) return next(req);

  const cloned = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

  return next(cloned).pipe(
    catchError((err) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && !isRefreshing) {
        isRefreshing = true;
        return auth.refreshToken().pipe(
          switchMap(() => {
            isRefreshing = false;
            const newToken = auth.getAccessToken();
            return next(req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } }));
          }),
          catchError((refreshErr) => {
            isRefreshing = false;
            auth.logout();
            return throwError(() => refreshErr);
          }),
        );
      }
      return throwError(() => err);
    }),
  );
};
