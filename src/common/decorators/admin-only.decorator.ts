import { SetMetadata } from '@nestjs/common';

export const ADMIN_ONLY_KEY = 'adminOnly';
/** Restricts a route (or controller) to users with the global ADMIN system role. */
export const AdminOnly = () => SetMetadata(ADMIN_ONLY_KEY, true);
