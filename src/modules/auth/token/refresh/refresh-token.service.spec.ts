import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RefreshTokenService } from './refresh-token.service';
import { TokenRepository } from './token.repository';

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  const tokenRepository = {
    create: vi.fn(),
    findByTokenHash: vi.fn(),
    rotate: vi.fn(),
    deleteById: vi.fn(),
    deleteAllForUser: vi.fn(),
    deleteExpiredForUser: vi.fn(),
    deleteExpired: vi.fn(),
  };
  const config = { getOrThrow: vi.fn().mockReturnValue(7) };
  const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [RefreshTokenService, { provide: TokenRepository, useValue: tokenRepository }, { provide: ConfigService, useValue: config }],
    }).compile();
    service = moduleRef.get(RefreshTokenService);
  });

  describe('create', () => {
    it('stores only the hash, with the configured lifetime, and returns the raw token', async () => {
      const params = { userId: randomUUID(), sid: randomUUID(), securityStamp: randomUUID() };
      const before = Date.now();

      const raw = await service.create(params);

      const stored = tokenRepository.create.mock.calls[0][0];
      expect(stored).toMatchObject({
        id: params.sid,
        userId: params.userId,
        securityStamp: params.securityStamp,
        tokenHash: sha256(raw),
      });
      expect(stored.tokenHash).not.toBe(raw);
      expect(stored.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('findByRawToken', () => {
    it('looks the token up by its hash', async () => {
      await service.findByRawToken('raw');
      expect(tokenRepository.findByTokenHash).toHaveBeenCalledWith(sha256('raw'));
    });
  });

  describe('rotate', () => {
    it('swaps in the hash of a new token with a fresh lifetime, and returns the raw token', async () => {
      tokenRepository.rotate.mockResolvedValue(true);
      const before = Date.now();

      const raw = await service.rotate('sid', 'current-hash');

      const [sid, currentHash, update] = tokenRepository.rotate.mock.calls[0];
      expect(sid).toBe('sid');
      expect(currentHash).toBe('current-hash');
      expect(update.tokenHash).toBe(sha256(raw as string));
      expect(update.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 7 * 24 * 60 * 60 * 1000);
    });

    it('returns null when the session no longer holds the current hash', async () => {
      tokenRepository.rotate.mockResolvedValue(false);
      await expect(service.rotate('sid', 'current-hash')).resolves.toBeNull();
    });
  });

  describe('revoke', () => {
    it('deletes the session token', async () => {
      await service.revoke('sid');
      expect(tokenRepository.deleteById).toHaveBeenCalledWith('sid');
    });
  });

  describe('revokeAllForUser', () => {
    it('deletes every token of the user', async () => {
      await service.revokeAllForUser('user');
      expect(tokenRepository.deleteAllForUser).toHaveBeenCalledWith('user');
    });
  });

  describe('pruneExpiredForUser', () => {
    it('deletes the expired tokens of the user', async () => {
      await service.pruneExpiredForUser('user');
      expect(tokenRepository.deleteExpiredForUser).toHaveBeenCalledWith('user');
    });
  });

  describe('deleteExpired', () => {
    it('deletes expired tokens for all users and returns the count', async () => {
      tokenRepository.deleteExpired.mockResolvedValue(4);
      await expect(service.deleteExpired()).resolves.toBe(4);
      expect(tokenRepository.deleteExpired).toHaveBeenCalledOnce();
    });
  });
});
