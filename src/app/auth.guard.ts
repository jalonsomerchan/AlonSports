import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { map } from 'rxjs';
import { AuthStore } from './app';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  return auth.initialize().pipe(map(authenticated => authenticated ? true : router.createUrlTree(['/login'])));
};
