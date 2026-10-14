import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RefreshTokenService } from './refresh-token.service';

/**
 * Deletes expired refresh tokens every day at 03:00 (server time).
 *
 * Tokens are also pruned per user whenever that user gets new tokens; this catches users who never come back. */
@Injectable()
export class RefreshTokenCleanupTask {
  private readonly logger = new Logger(RefreshTokenCleanupTask.name);

  constructor(private readonly refreshTokens: RefreshTokenService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'delete-expired-refresh-tokens' })
  async deleteExpiredRefreshTokens(): Promise<void> {
    try {
      const deleted = await this.refreshTokens.deleteExpired();
      this.logger.log(`Deleted ${deleted} expired refresh token(s)`);
    } catch (error) {
      // A background job has no caller to report to: log it, and tomorrow's run retries.
      this.logger.error('Failed to delete expired refresh tokens', error instanceof Error ? error.stack : String(error));
    }
  }
}
