import { ExecutionContext, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IS_PUBLIC_KEY } from '@common/decorators';
import { UserRole } from '@common/enums';
import { RolesGuard } from './roles.guard';
import { buildUser } from '../../../../test/factories/user.factory';

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: vi.fn() };
  const guard = new RolesGuard(reflector as unknown as Reflector);

  let request: { user?: unknown };
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const withMetadata = ({ isPublic = false, roles }: { isPublic?: boolean; roles?: UserRole[] }) =>
    reflector.getAllAndOverride.mockImplementation((key: unknown) => (key === IS_PUBLIC_KEY ? isPublic : roles));

  beforeEach(() => {
    vi.clearAllMocks();
    request = { user: buildUser() };
  });

  it('lets public routes through', () => {
    withMetadata({ isPublic: true, roles: [UserRole.SUPER_ADMIN] });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('lets routes without role metadata through', () => {
    withMetadata({});
    expect(guard.canActivate(context)).toBe(true);
  });

  it('lets a user with an allowed role through', () => {
    withMetadata({ roles: [UserRole.EMPLOYEE] });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('always lets a super admin through', () => {
    withMetadata({ roles: [UserRole.EMPLOYEE] });
    request.user = buildUser({ role: UserRole.SUPER_ADMIN });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('returns 404 (not 403) to a user without an allowed role', () => {
    withMetadata({ roles: [UserRole.SUPER_ADMIN] });
    expect(() => guard.canActivate(context)).toThrow(NotFoundException);
  });

  it('fails closed with 401 when no user is attached', () => {
    withMetadata({ roles: [UserRole.SUPER_ADMIN] });
    request.user = undefined;
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
