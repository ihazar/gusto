import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '@gusto/contracts';
import { AuthService } from './auth.service';

/** Allows only signed-in users with the ADMIN role into the ops console. */
export const adminGuard: CanActivateFn = () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return auth.user()?.roles?.includes(UserRole.ADMIN) ? true : router.createUrlTree(['/']);
};
