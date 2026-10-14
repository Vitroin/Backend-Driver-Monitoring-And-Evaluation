import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TokenService } from './token.service';
import { RefreshTokenService } from './refresh-token.service';
import { AccessTokenService } from './access token/access-token.service';
import { OneTimeTokenService } from './one-time-token/one-time-token.service';
import { OneTimeTokenPurpose } from './token.constants';
import { RefreshToken } from './refresh/token.model';

const buildRefreshToken = (overrides: Partial<RefreshToken> = {}): RefreshToken =>
  Object.assign(new RefreshToken(), {
    id: randomUUID(),
    userId: randomUUID(),
    securityStamp: randomUUID(),
    tokenHash: 'hash',
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  });

describe('TokenService', () => {
  let service: TokenService;
  const refreshTokens = {
    create: vi.fn(),
    findByRawToken: vi.fn(),
    rotate: vi.fn(),
    revoke: vi.fn(),
    revokeAllForUser: vi.fn(),
    pruneExpiredForUser: vi.fn(),
  };
  const accessTokens = { sign: vi.fn(), verify: vi.fn(), block: vi.fn(), isBlocked: vi.fn() };
  const oneTimeTokens = { issue: vi.fn(), consume: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: RefreshTokenService, useValue: refreshTokens },
        { provide: AccessTokenService, useValue: accessTokens },
        { provide: OneTimeTokenService, useValue: oneTimeTokens },
      ],
    }).compile();
    service = moduleRef.get(TokenService);
  });

  describe('issueTokens', () => {
    it('issues an access token and a refresh token sharing a new sid', async () => {
      refreshTokens.create.mockResolvedValue('refresh');
      accessTokens.sign.mockReturnValue('access');
      const userId = randomUUID();

      await expect(service.issueTokens(userId, 'stamp')).resolves.toEqual({
        accessToken: 'access',
        refreshToken: 'refresh',
      });
      const { sid } = refreshTokens.create.mock.calls[0][0];
      expect(refreshTokens.pruneExpiredForUser).toHaveBeenCalledWith(userId);
      expect(refreshTokens.create).toHaveBeenCalledWith({ userId, sid, securityStamp: 'stamp' });
      expect(accessTokens.sign).toHaveBeenCalledWith({ sid, userId, securityStamp: 'stamp' });
    });

    it('starts a different session on every call', async () => {
      await service.issueTokens(randomUUID(), 'stamp');
      await service.issueTokens(randomUUID(), 'stamp');
      expect(refreshTokens.create.mock.calls[0][0].sid).not.toBe(refreshTokens.create.mock.calls[1][0].sid);
    });
  });

  describe('findRefreshSession', () => {
    it('returns the session of a valid token', async () => {
      const token = buildRefreshToken();
      refreshTokens.findByRawToken.mockResolvedValue(token);

      await expect(service.findRefreshSession('raw')).resolves.toEqual({
        id: token.id,
        userId: token.userId,
        securityStamp: token.securityStamp,
        tokenHash: token.tokenHash,
      });
    });

    it('throws for an unknown token', async () => {
      refreshTokens.findByRawToken.mockResolvedValue(null);
      await expect(service.findRefreshSession('raw')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(refreshTokens.revoke).not.toHaveBeenCalled();
    });

    it('revokes the session of an expired token', async () => {
      const token = buildRefreshToken({ expiresAt: new Date(Date.now() - 1000) });
      refreshTokens.findByRawToken.mockResolvedValue(token);

      await expect(service.findRefreshSession('raw')).rejects.toThrow('Refresh token has expired. Please login again');
      expect(refreshTokens.revoke).toHaveBeenCalledWith(token.id);
    });
  });

  describe('rotateRefreshToken', () => {
    const session = { id: randomUUID(), userId: randomUUID(), securityStamp: randomUUID(), tokenHash: 'hash' };

    it('rotates the refresh token in place and issues an access token for the same sid', async () => {
      refreshTokens.rotate.mockResolvedValue('refresh');
      accessTokens.sign.mockReturnValue('access');

      await expect(service.rotateRefreshToken(session)).resolves.toEqual({
        accessToken: 'access',
        refreshToken: 'refresh',
      });
      expect(refreshTokens.rotate).toHaveBeenCalledWith(session.id, session.tokenHash);
      expect(accessTokens.sign).toHaveBeenCalledWith({
        sid: session.id,
        userId: session.userId,
        securityStamp: session.securityStamp,
      });
      expect(refreshTokens.create).not.toHaveBeenCalled();
    });

    it('throws when another request already rotated the token', async () => {
      refreshTokens.rotate.mockResolvedValue(null);

      await expect(service.rotateRefreshToken(session)).rejects.toThrow(
        'Refresh token has already been used. Please login again',
      );
      expect(accessTokens.sign).not.toHaveBeenCalled();
    });
  });

  describe('revokeSession', () => {
    it('blocks the access token for its remaining lifetime and deletes the refresh token', async () => {
      vi.useFakeTimers({ now: 1_000_000_000_000 });
      const sid = randomUUID();

      await service.revokeSession(sid, 1_000_000_000 + 300);
      expect(accessTokens.block).toHaveBeenCalledWith(sid, 300);
      expect(refreshTokens.revoke).toHaveBeenCalledWith(sid);
      vi.useRealTimers();
    });
  });

  describe('revokeRefreshSession', () => {
    it('delegates to the refresh token service', async () => {
      await service.revokeRefreshSession('sid');
      expect(refreshTokens.revoke).toHaveBeenCalledWith('sid');
    });
  });

  describe('revokeAllRefreshTokens', () => {
    it('delegates to the refresh token service', async () => {
      await service.revokeAllRefreshTokens('user');
      expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('user');
    });
  });

  describe('verifyAccessToken', () => {
    it('delegates to the access token service', () => {
      accessTokens.verify.mockReturnValue({ sid: 's' });
      expect(service.verifyAccessToken('jwt')).toEqual({ sid: 's' });
      expect(accessTokens.verify).toHaveBeenCalledWith('jwt');
    });
  });

  describe('isAccessTokenBlocked', () => {
    it('delegates to the access token service', async () => {
      accessTokens.isBlocked.mockResolvedValue(true);
      await expect(service.isAccessTokenBlocked('sid')).resolves.toBe(true);
    });
  });

  describe('issueOneTimeToken', () => {
    it('delegates to the one-time token service', async () => {
      oneTimeTokens.issue.mockResolvedValue('token');
      await expect(service.issueOneTimeToken(OneTimeTokenPurpose.PASSWORD_RESET, 'user')).resolves.toBe('token');
      expect(oneTimeTokens.issue).toHaveBeenCalledWith(OneTimeTokenPurpose.PASSWORD_RESET, 'user');
    });
  });

  describe('consumeOneTimeToken', () => {
    it('returns the user id the token was issued for', async () => {
      oneTimeTokens.consume.mockResolvedValue('user');
      await expect(service.consumeOneTimeToken(OneTimeTokenPurpose.PASSWORD_RESET, 'token')).resolves.toBe('user');
    });

    it('propagates an invalid token error', async () => {
      oneTimeTokens.consume.mockRejectedValueOnce(new UnauthorizedException());
      await expect(service.consumeOneTimeToken(OneTimeTokenPurpose.PASSWORD_RESET, 'token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
