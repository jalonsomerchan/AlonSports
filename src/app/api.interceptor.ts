import { HttpBackend, HttpClient, HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, tap, throwError } from 'rxjs';
import { API_BASE_URL, ApiSession, CsrfStore } from './app';

const AUTH_RETRY = new HttpContextToken<boolean>(() => false);

export const apiInterceptor: HttpInterceptorFn = (request, next) => {
  const csrf = inject(CsrfStore);
  const router = inject(Router);
  const backend = inject(HttpBackend);
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
  const isApiRequest = request.url.startsWith(API_BASE_URL);
  const isSessionRequest = request.url === `${API_BASE_URL}/auth/session`;
  const withAuth = (current = request) => {
    const headers = isMutation && csrf.token() ? current.headers.set('X-CSRF-Token', csrf.token()) : current.headers;
    return current.clone({ withCredentials: true, headers });
  };
  return next(withAuth()).pipe(
    catchError(error => {
      if (!isApiRequest) return throwError(() => error);
      if (error.status === 401) {
        csrf.clear();
        if (typeof window !== 'undefined') router.navigateByUrl('/login');
        return throwError(() => error);
      }
      if (error.status !== 419 || isSessionRequest || request.context.get(AUTH_RETRY)) return throwError(() => error);

      return new HttpClient(backend).get<ApiSession>(`${API_BASE_URL}/auth/session`, { withCredentials: true }).pipe(
        tap(session => csrf.set(session.csrf_token)),
        switchMap(() => next(withAuth(request.clone({ context: request.context.set(AUTH_RETRY, true) })))),
        catchError(refreshError => {
          if (refreshError.status === 401) {
            csrf.clear();
            if (typeof window !== 'undefined') router.navigateByUrl('/login');
          }
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
