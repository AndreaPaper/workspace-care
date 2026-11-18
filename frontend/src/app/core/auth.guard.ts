import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PocketBaseService } from './pocketbase.service';

export const authGuard: CanActivateFn = () => {
  const pb = inject(PocketBaseService);
  return pb.isLoggedIn() ? true : inject(Router).createUrlTree(['/login']);
};
