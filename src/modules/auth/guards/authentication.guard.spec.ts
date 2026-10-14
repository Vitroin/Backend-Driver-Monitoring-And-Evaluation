import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TokenExpiredError } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserStatus } from '@common/enums';
import type { UsersService } from '@modules/users';
import type { TokenService } from '../token';
import { AuthenticationGuard } from './authentication.guard';
import { buildUser } from '../../../../test/factories/user.factory';

describe('AuthenticationGuard', () => {
  const tokenService = { verifyAccessToken: vi.fn(), isAccessTokenBlocked: vi.fn() };
  const usersService = { findForAuthentication: vi.fn() };
  const reflector = { getAllAndOverride: vi.fn() };
  const guard = new AuthenticationGuard(tokenService as unknown as TokenService, usersService as unknown as UsersService, reflector as unknown as Reflector);

  let request: { headers: { authorization?: string }; user?: unknown; session?: unknown };
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  const user = buildUser({ id: randomUUID() });
  const payload = { sid: randomUUID(), userId: user.id, securityStamp: user.securityStamp, iat: 1, exp: 2_000_000_000 };

  beforeEach(() => {
    vi.clearAllMocks();
    reflector.getAllAndOverride.mockReturnValue(false);
    request = { headers: { authorization: 'Bearer valid.jwt' } };
    tokenService.verifyAccessToken.mockReturnValue(payload);
    tokenService.isAccessTokenBlocked.mockResolvedValue(false);
    usersService.findForAuthentication.mockResolvedValue(user);
  });

  it('lets public routes through without a token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    request.headers = {};
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('attaches the user and the session for a valid token', async () => {
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(tokenService.verifyAccessToken).toHaveBeenCalledWith('valid.jwt');
    expect(request.user).toBe(user);
    expect(request.session).toEqual({ sid: payload.sid, exp: payload.exp });
  });

  it('accepts a lowercase bearer scheme', async () => {
    request.headers.authorization = 'bearer valid.jwt';
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it.each([
    ['a missing header', undefined, 'Authorization token is required'],
    ['a non-Bearer scheme', 'Basic abc', 'Invalid token format. Please login again'],
    ['a Bearer header without a token', 'Bearer', 'Invalid token format. Please login again'],
  ])('returns 401 for %s', async (_, authorization, message) => {
    request.headers.authorization = authorization;
    await expect(guard.canActivate(context)).rejects.toThrow(new UnauthorizedException(message));
  });

  it('returns 401 for an expired token', async () => {
    tokenService.verifyAccessToken.mockImplementationOnce(() => {
      throw new TokenExpiredError('jwt expired', new Date());
    });
    await expect(guard.canActivate(context)).rejects.toThrow(new UnauthorizedException('Token has expired. Please login again'));
  });

  it('returns 401 for a token that fails verification', async () => {
    tokenService.verifyAccessToken.mockImplementationOnce(() => {
      throw new Error('invalid signature');
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns 401 for a correctly signed token with missing claims', async () => {
    tokenService.verifyAccessToken.mockReturnValueOnce({ sid: payload.sid, userId: payload.userId, iat: 1, exp: 2 });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(usersService.findForAuthentication).not.toHaveBeenCalled();
  });

  it('returns 401 for a blocked (logged out) token', async () => {
    tokenService.isAccessTokenBlocked.mockResolvedValueOnce(true);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns 401 when the user no longer exists', async () => {
    usersService.findForAuthentication.mockResolvedValueOnce(null);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns 401 when the security stamp was rotated after the token was issued', async () => {
    usersService.findForAuthentication.mockResolvedValueOnce({ ...user, securityStamp: randomUUID() });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns 403 for a user who is not active', async () => {
    usersService.findForAuthentication.mockResolvedValueOnce({ ...user, status: UserStatus.DISABLED });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns 403 for a user who must change their password', async () => {
    usersService.findForAuthentication.mockResolvedValueOnce({ ...user, mustChangePassword: true });
    await expect(guard.canActivate(context)).rejects.toThrow(new ForbiddenException('Password change required. Please change your password to continue'));
  });
});
