import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheService } from '@infrastructure/cache/cache.service';
import { OneTimeTokenService } from './one-time-token.service';
import { ONE_TIME_TOKEN_TTL_SECONDS, OneTimeTokenPurpose } from '../token.constants';

describe('OneTimeTokenService', () => {
  let service: OneTimeTokenService;
  const cacheService = { set: vi.fn(), take: vi.fn() };
  const keyFor = (purpose: OneTimeTokenPurpose, token: string): string => `one_time_token:${purpose}:${createHash('sha256').update(token).digest('hex')}`;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [OneTimeTokenService, { provide: CacheService, useValue: cacheService }],
    }).compile();
    service = moduleRef.get(OneTimeTokenService);
  });

  describe('issue', () => {
    it('stores the user id under a hash of a random token, with the purpose lifetime', async () => {
      const token = await service.issue(OneTimeTokenPurpose.ACCOUNT_ACTIVATION, 'user-id');

      expect(token.length).toBeGreaterThanOrEqual(43);
      expect(cacheService.set).toHaveBeenCalledWith({
        key: keyFor(OneTimeTokenPurpose.ACCOUNT_ACTIVATION, token),
        value: 'user-id',
        ttl: ONE_TIME_TOKEN_TTL_SECONDS[OneTimeTokenPurpose.ACCOUNT_ACTIVATION],
      });
    });

    it('generates a different token each time', async () => {
      const first = await service.issue(OneTimeTokenPurpose.PASSWORD_RESET, 'user-id');
      const second = await service.issue(OneTimeTokenPurpose.PASSWORD_RESET, 'user-id');
      expect(first).not.toBe(second);
    });
  });

  describe('consume', () => {
    it('atomically takes the token and returns its user id', async () => {
      cacheService.take.mockResolvedValue('user-id');
      await expect(service.consume(OneTimeTokenPurpose.PASSWORD_RESET, 'token')).resolves.toBe('user-id');
      expect(cacheService.take).toHaveBeenCalledWith(keyFor(OneTimeTokenPurpose.PASSWORD_RESET, 'token'));
    });

    it('throws for an unknown, expired or already used token', async () => {
      cacheService.take.mockResolvedValue(undefined);
      await expect(service.consume(OneTimeTokenPurpose.PASSWORD_RESET, 'token')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('keeps purposes apart: a reset token is looked up only in the reset key space', async () => {
      cacheService.take.mockResolvedValue(undefined);
      await expect(service.consume(OneTimeTokenPurpose.ACCOUNT_ACTIVATION, 'token')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(cacheService.take).toHaveBeenCalledWith(keyFor(OneTimeTokenPurpose.ACCOUNT_ACTIVATION, 'token'));
    });
  });
});
