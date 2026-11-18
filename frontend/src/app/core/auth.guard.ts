import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PocketBaseService } from './pocketbase.service';

export const authGuard: CanActivateFn = async () => {
  // inject() only works synchronously, so resolve dependencies before the first await.
  const pb = inject(PocketBaseService);
  const router = inject(Router);
  if (await pb.autoLogin()) return true;
  return router.createUrlTree(['/login']);
};
