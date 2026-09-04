import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { CsrfStore } from './app';

export const apiInterceptor: HttpInterceptorFn = (request, next) => {
  const csrf = inject(CsrfStore).token();
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
  const headers = isMutation && csrf ? request.headers.set('X-CSRF-Token', csrf) : request.headers;
  return next(request.clone({ withCredentials: true, headers }));
};
