import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@common/decorators';
import type { AuthenticatedRequest } from '@common/interfaces';
import { Authenticator } from '../authenticator.service';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly authenticator: Authenticator,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { user, session } = await this.authenticator.authenticate(request.headers.authorization);
    request.user = user;
    request.session = session;
    return true;
  }
}
