import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { CacheService } from '@infrastructure/cache';
import { ONE_TIME_TOKEN_TTL_SECONDS, OneTimeTokenPurpose } from '../token.constants';

@Injectable()
export class OneTimeTokenService {
  constructor(private readonly cache: CacheService) {}

  async issue(purpose: OneTimeTokenPurpose, userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('base64url');
    await this.cache.set({ key: this.cacheKey(purpose, token), value: userId, ttl: ONE_TIME_TOKEN_TTL_SECONDS[purpose] });
    return token;
  }

  async consume(purpose: OneTimeTokenPurpose, token: string): Promise<string> {
    const userId = await this.cache.take<string>(this.cacheKey(purpose, token));
    if (!userId) throw new UnauthorizedException('Invalid or expired token');
    return userId;
  }

  private cacheKey(purpose: OneTimeTokenPurpose, token: string): string {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    return `one_time_token:${purpose}:${hash}`;
  }
}