import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth/auth-service';

/**
 * Garde de route : accès réservé aux utilisateurs role='admin'.
 * - non connecté         -> /login
 * - connecté mais child  -> /
 */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }
  if (!auth.isAdmin()) {
    router.navigate(['/']);
    return false;
  }
  return true;
};
