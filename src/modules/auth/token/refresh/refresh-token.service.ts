import { ConfigNames } from '@config';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import { TokenRepository } from './token.repository';

@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly tokenRepository: TokenRepository,
    private readonly config: ConfigService,
  ) {}

  /**
   * Generates a refresh token and stores its hash. Only the hash is persisted; the raw token is returned once.
   * @param params.sid - The session id, shared with the access tokens; used as the row id.
   * @returns The raw refresh token.
   */
  async create(params: { userId: string; sid: string; securityStamp: string }): Promise<string> {
    const refreshToken = this.generate();
    await this.tokenRepository.createSession({
      ...params,
      tokenHash: this.hash(refreshToken),
      expiresAt: this.expiresAt(),
    });
    return refreshToken;
  }

  findByRawToken(rawToken: string) {
    return this.tokenRepository.findByTokenHash(this.hash(rawToken));
  }

  async revoke(sid: string): Promise<void> {
    await this.tokenRepository.deleteById(sid);
  }

  /**
   * Replaces the session's refresh token with a new one and restarts its lifetime.
   * @param currentHash - The hash of the token being rotated. The swap only happens if the session still holds it.
   * @returns The new raw refresh token, or `null` if the token was already rotated (another request used it first).
   */
  async rotate(sid: string, currentHash: string): Promise<string | null> {
    const refreshToken = this.generate();
    const rotated = await this.tokenRepository.rotate(sid, currentHash, {
      tokenHash: this.hash(refreshToken),
      expiresAt: this.expiresAt(),
    });
    return rotated ? refreshToken : null;
  }

  revokeAllForUser(userId: string): Promise<void> {
    return this.tokenRepository.deleteAllForUser(userId);
  }

  /** Deletes the user's expired tokens. Runs on every issue, so the table can't grow without bound. */
  pruneExpiredForUser(userId: string): Promise<void> {
    return this.tokenRepository.deleteExpiredForUser(userId);
  }

  /** Deletes every expired token, for all users. Run daily by `RefreshTokenCleanupTask`. @returns How many were deleted. */
  deleteExpired(): Promise<number> {
    return this.tokenRepository.deleteExpired();
  }

  private generate(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  private expiresAt(): Date {
    const ttlDays = this.config.getOrThrow<number>(ConfigNames.JWT_REFRESH_TOKEN_TTL_DAYS);
    return new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  }

  private hash(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }
}
