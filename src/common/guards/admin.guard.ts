import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_ONLY_KEY } from '../decorators/admin-only.decorator';
import { SystemRole } from '../../users/user.entity';

/** Global guard: enforces @AdminOnly(). Runs after JwtAuthGuard. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const adminOnly = this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!adminOnly) return true;
    const user = context.switchToHttp().getRequest().user;
    if (user?.systemRole !== SystemRole.ADMIN) {
      throw new ForbiddenException('Administrator privileges required');
    }
    return true;
  }
}
