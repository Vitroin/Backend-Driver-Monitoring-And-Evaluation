import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RefreshTokenCleanupTask } from '../refresh/refresh-token-cleanup.task';
import { RefreshTokenService } from '../refresh/refresh-token.service';

// Metadata key @Cron() stores its options under (not exported from @nestjs/schedule's public entry point).
const SCHEDULE_CRON_OPTIONS = 'SCHEDULE_CRON_OPTIONS';

describe('RefreshTokenCleanupTask', () => {
  let task: RefreshTokenCleanupTask;
  const refreshTokens = { deleteExpired: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [RefreshTokenCleanupTask, { provide: RefreshTokenService, useValue: refreshTokens }],
    }).compile();
    task = moduleRef.get(RefreshTokenCleanupTask);
  });

  it('is scheduled daily at 03:00', () => {
    const options = Reflect.getMetadata(SCHEDULE_CRON_OPTIONS, RefreshTokenCleanupTask.prototype.deleteExpiredRefreshTokens);
    expect(options).toMatchObject({ cronTime: CronExpression.EVERY_DAY_AT_3AM, name: 'delete-expired-refresh-tokens' });
  });

  describe('deleteExpiredRefreshTokens', () => {
    it('deletes expired refresh tokens and logs how many', async () => {
      refreshTokens.deleteExpired.mockResolvedValue(3);
      const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

      await task.deleteExpiredRefreshTokens();
      expect(refreshTokens.deleteExpired).toHaveBeenCalledOnce();
      expect(log).toHaveBeenCalledWith('Deleted 3 expired refresh token(s)');
      log.mockRestore();
    });

    it('logs and swallows a failure so the scheduler keeps running', async () => {
      refreshTokens.deleteExpired.mockRejectedValueOnce(new Error('db down'));
      const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await expect(task.deleteExpiredRefreshTokens()).resolves.toBeUndefined();
      expect(error).toHaveBeenCalledWith('Failed to delete expired refresh tokens', expect.stringContaining('db down'));
      error.mockRestore();
    });
  });
});
