import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Allows the route only for signed-in users.
 * Waits for the persisted session to be resolved before deciding,
 * so a page refresh on a protected route keeps the user signed in.
 */
export const authGuard: CanActivateFn = async (_route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.ready()) await auth.waitForSession();
  // Remember where the guest was headed so sign-in can send them back there.
  return auth.user() ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};