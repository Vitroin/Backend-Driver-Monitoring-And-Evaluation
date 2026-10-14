import { CacheService } from '@infrastructure/cache';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenClaims } from './access-token-payload.schema';

@Injectable()
export class AccessTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly cacheService: CacheService,
  ) {}

  sign(claims: AccessTokenClaims): string {
    return this.jwtService.sign(claims);
  }

  /**
   * Verifies the signature, algorithm, issuer, audience and expiry (see `jwt-module.config.ts`).
   * Throws `jsonwebtoken` errors (e.g. `TokenExpiredError`) when the token is not valid.
   * The claims are not checked here: callers parse the result with `accessTokenPayloadSchema`.
   */
  verify(token: string): unknown {
    return this.jwtService.verify<object>(token);
  }

  /**
   * Blocks an access token until it would have expired anyway.
   * @param sid - The `sid` of the access token to block.
   * @param ttlSeconds - Seconds until the token expires. Nothing is stored when it already has.
   */
  async block(sid: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    await this.cacheService.set({ key: this.blockKey(sid), value: true, ttl: ttlSeconds });
  }

  async isBlocked(sid: string): Promise<boolean> {
    return (await this.cacheService.get<boolean>(this.blockKey(sid))) === true;
  }

  private blockKey(sid: string): string {
    return `blocked_access_token:${sid}`;
  }
}
