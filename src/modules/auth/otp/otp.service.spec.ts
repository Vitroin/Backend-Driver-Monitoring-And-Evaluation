import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Config } from '@config';
import { CacheService } from '@infrastructure/cache/cache.service';
import { OTP_MAX_ATTEMPTS, OtpService } from './otp.service';

/** An in-memory stand-in for CacheService, so issue/verify round-trip for real. */
const createCache = () => {
  const store = new Map<string, unknown>();
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key)),
    set: vi.fn(async ({ key, value }: { key: string; value: unknown; ttl?: number }) => void store.set(key, value)),
    delete: vi.fn(async (key: string) => store.delete(key)),
    take: vi.fn(async (key: string) => {
      const value = store.get(key);
      return store.delete(key) ? value : undefined;
    }),
  };
};

describe('OtpService', () => {
  let service: OtpService;
  let cache: ReturnType<typeof createCache>;
  const config = {
    getOrThrow: vi.fn((key: string) => ({ [Config.OTP_SECRET]: 'x'.repeat(32), [Config.OTP_EXPIRY_MINUTES]: 5 })[key]),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    cache = createCache();
    const moduleRef = await Test.createTestingModule({
      providers: [OtpService, { provide: CacheService, useValue: cache }, { provide: ConfigService, useValue: config }],
    }).compile();
    service = moduleRef.get(OtpService);
  });

  describe('generate', () => {
    it('returns a zero-padded numeric code of the requested length', () => {
      expect(service.generate()).toMatch(/^\d{6}$/);
      expect(service.generate(8)).toMatch(/^\d{8}$/);
    });
  });

  describe('issue', () => {
    it('stores an HMAC of the OTP (never the OTP itself) with the configured lifetime', async () => {
      const otp = await service.issue('key');

      const [{ value, ttl }] = cache.set.mock.calls[0] as unknown as [{ value: unknown; ttl: number }];
      expect(ttl).toBe(300);
      expect(JSON.stringify(value)).not.toContain(otp);
      expect(value).toMatchObject({ attempts: 0, hash: expect.stringMatching(/^[0-9a-f]{64}$/) });
    });

    it('rejects a second request within the cooldown with 429', async () => {
      await service.issue('key');
      await expect(service.issue('key')).rejects.toBeInstanceOf(HttpException);
    });
  });

  describe('verify', () => {
    it('accepts the right OTP once', async () => {
      const otp = await service.issue('key');
      await expect(service.verify('key', otp)).resolves.toBe(true);
      await expect(service.verify('key', otp)).resolves.toBe(false);
    });

    it('rejects a wrong OTP and counts the attempt', async () => {
      const otp = await service.issue('key');
      const wrong = otp === '000000' ? '111111' : '000000';

      await expect(service.verify('key', wrong)).resolves.toBe(false);
      expect(cache.store.get('key')).toMatchObject({ attempts: 1 });
      await expect(service.verify('key', otp)).resolves.toBe(true);
    });

    it(`deletes the OTP after ${OTP_MAX_ATTEMPTS} wrong guesses`, async () => {
      const otp = await service.issue('key');
      const wrong = otp === '000000' ? '111111' : '000000';

      for (let attempt = 0; attempt < OTP_MAX_ATTEMPTS; attempt++) await service.verify('key', wrong);

      expect(cache.store.has('key')).toBe(false);
      await expect(service.verify('key', otp)).resolves.toBe(false);
    });

    it('returns false when no OTP was issued', async () => {
      await expect(service.verify('missing', '123456')).resolves.toBe(false);
    });
  });
});
