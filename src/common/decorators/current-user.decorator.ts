import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '@common/interfaces';

/** The user set by AuthenticationGuard, or one of its fields: `@CurrentUser('id')`. */
export const CurrentUser = createParamDecorator((field: string | undefined, ctx: ExecutionContext) => {
  const user = ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
  return field ? user?.[field as keyof typeof user] : user;
});

export const CurrentSession = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AuthenticatedRequest>().session;
});