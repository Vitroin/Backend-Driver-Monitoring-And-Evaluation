import { AllowedRoles, AuthenticatedRequest } from '@common';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const allowedRoles = this.reflector.getAllAndOverride<string[]>(AllowedRoles, [context.getHandler(), context.getClass()]);
    if (!allowedRoles) return true;

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) return false;

    if (!allowedRoles.includes(user.role)) return false;

    return true;
  }
}
