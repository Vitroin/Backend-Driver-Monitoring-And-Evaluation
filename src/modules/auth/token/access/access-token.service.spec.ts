import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheService } from '@infrastructure/cache/cache.service';
import { AccessTokenService } from './access-token.service';

describe('AccessTokenService', () => {
  let service: AccessTokenService;
  const jwtService = { sign: vi.fn(), verify: vi.fn() };
  const cacheService = { get: vi.fn(), set: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [AccessTokenService, { provide: JwtService, useValue: jwtService }, { provide: CacheService, useValue: cacheService }],
    }).compile();
    service = moduleRef.get(AccessTokenService);
  });

  describe('sign', () => {
    it('signs the claims', () => {
      jwtService.sign.mockReturnValue('jwt');
      const claims = { sid: 's', userId: 'u', securityStamp: 'st' };
      expect(service.sign(claims)).toBe('jwt');
      expect(jwtService.sign).toHaveBeenCalledWith(claims);
    });
  });

  describe('verify', () => {
    it('returns the verified payload', () => {
      jwtService.verify.mockReturnValue({ sid: 's' });
      expect(service.verify('jwt')).toEqual({ sid: 's' });
    });

    it('propagates verification errors', () => {
      jwtService.verify.mockImplementationOnce(() => {
        throw new Error('invalid signature');
      });
      expect(() => service.verify('jwt')).toThrow('invalid signature');
    });
  });

  describe('block', () => {
    it('stores the sid for the remaining lifetime', async () => {
      await service.block('sid', 120);
      expect(cacheService.set).toHaveBeenCalledWith({ key: 'blocked_access_token:sid', value: true, ttl: 120 });
    });

    it('stores nothing for a token that has already expired', async () => {
      await service.block('sid', 0);
      expect(cacheService.set).not.toHaveBeenCalled();
    });
  });

  describe('isBlocked', () => {
    it('is true for a blocked sid', async () => {
      cacheService.get.mockResolvedValue(true);
      await expect(service.isBlocked('sid')).resolves.toBe(true);
      expect(cacheService.get).toHaveBeenCalledWith('blocked_access_token:sid');
    });

    it('is false for an unknown sid', async () => {
      cacheService.get.mockResolvedValue(undefined);
      await expect(service.isBlocked('sid')).resolves.toBe(false);
    });
  });
});
