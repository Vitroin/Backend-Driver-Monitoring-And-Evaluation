import { CanActivate, ExecutionContext, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AllowedRoles, IS_PUBLIC_KEY } from '@common/decorators';
import { UserRole } from '@common/enums';
import type { AuthenticatedRequest } from '@common/interfaces';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const allowedRoles = this.reflector.getAllAndOverride(AllowedRoles, [context.getHandler(), context.getClass()]);
    if (!allowedRoles || allowedRoles.length === 0) return true;

    // AuthenticationGuard runs first and sets the user. Fail closed if it ever doesn't.
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) throw new UnauthorizedException('Authorization token is required');
    if (user.role === UserRole.SUPER_ADMIN) return true;

    // 404 rather than 403, so the route's existence isn't revealed to users who can't use it.
    if (!allowedRoles.includes(user.role)) throw new NotFoundException('Resource not found');
    return true;
  }
}
