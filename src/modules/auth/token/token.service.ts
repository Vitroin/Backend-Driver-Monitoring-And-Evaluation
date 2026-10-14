import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { RefreshTokenService } from './refresh';
import { AccessTokenService } from './access';
import { OneTimeTokenService } from './one-time';
import { OneTimeTokenPurpose } from './token.constants';
import { Types } from 'mongoose';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** A session whose presented refresh token is valid to rotate: known and not expired. */
export interface RefreshSession {
  /** The session id (`sid in the access token`). */
  id: string;
  userId: string;
  securityStamp: string;
  /** Hash of the presented refresh token. Rotation only succeeds while the session still holds it. */
  tokenHash: string;
}

/** The only provider `TokenModule` exports. Everything token-related goes through here. */
@Injectable()
export class TokenService {
  constructor(
    private readonly refreshTokens: RefreshTokenService,
    private readonly accessTokens: AccessTokenService,
    private readonly oneTimeTokens: OneTimeTokenService,
  ) {}

  /** Starts a new session (a login): issues an access token and a refresh token that share a new session id (`sid`). */
  async issueTokens(userId: string, securityStamp: string): Promise<TokenPair> {
    await this.refreshTokens.pruneExpiredForUser(userId);
    const sid = new Types.ObjectId().toString();
    const refreshToken = await this.refreshTokens.create({ userId, sid, securityStamp });
    const accessToken = this.accessTokens.sign({ sid, userId, securityStamp });
    return { accessToken, refreshToken };
  }

  /**
   * Looks up the session of a refresh token that is about to be rotated. An expired session is deleted.
   * A token that was already rotated is no longer stored, so it is rejected as unknown.
   * @throws UnauthorizedException when the token is unknown or expired.
   */
  async findRefreshSession(rawRefreshToken: string): Promise<RefreshSession> {
    const token = await this.refreshTokens.findByRawToken(rawRefreshToken);
    if (!token) throw new UnauthorizedException('Refresh token is invalid. Please login again');
    if (token.expiresAt <= new Date()) {
      await this.refreshTokens.revoke(token.id);
      throw new UnauthorizedException('Refresh token has expired. Please login again');
    }
    return {
      id: token.id,
      userId: token.userId.toString(),
      securityStamp: token.securityStamp.toString(),
      tokenHash: token.tokenHash,
    };
  }

  /**
   * Replaces the session's refresh token and issues a new access token for the same `sid`.
   * @throws UnauthorizedException if another request rotated the token first.
   */
  async rotateRefreshToken(session: RefreshSession): Promise<TokenPair> {
    const refreshToken = await this.refreshTokens.rotate(session.id, session.tokenHash);
    if (!refreshToken) throw new UnauthorizedException('Refresh token has already been used. Please login again');
    const accessToken = this.accessTokens.sign({
      sid: session.id,
      userId: session.userId,
      securityStamp: session.securityStamp,
    });
    return { accessToken, refreshToken };
  }

  /** Deletes a session's refresh token (used when the session's user is no longer allowed in). */
  revokeRefreshSession(sid: string): Promise<void> {
    return this.refreshTokens.revoke(sid);
  }

  /** Verifies an access token. Throws `jsonwebtoken` errors; the returned claims are not validated yet. */
  verifyAccessToken(token: string): unknown {
    return this.accessTokens.verify(token);
  }

  isAccessTokenBlocked(sid: string): Promise<boolean> {
    return this.accessTokens.isBlocked(sid);
  }

  /**
   * Ends one session: blocks its access tokens for the rest of their lifetime and deletes its refresh token.
   * @param exp - The access token's `exp` claim, in seconds since the epoch.
   */
  async revokeSession(sid: string, exp: number): Promise<void> {
    await this.accessTokens.block(sid, exp - Math.floor(Date.now() / 1000));
    await this.refreshTokens.revoke(sid);
  }

  /**
   * Deletes every refresh token the user has. Their access tokens stop working only once the user's
   * security stamp is rotated, so call this together with `UsersService.rotateSecurityStamp`/`setPassword`.
   */
  revokeAllRefreshTokens(userId: string): Promise<void> {
    return this.refreshTokens.revokeAllForUser(userId);
  }

  issueOneTimeToken(purpose: OneTimeTokenPurpose, userId: string): Promise<string> {
    return this.oneTimeTokens.issue(purpose, userId);
  }

  /** @returns The id of the user the token was issued for. Throws 401 if it is invalid, expired or used. */
  consumeOneTimeToken(purpose: OneTimeTokenPurpose, token: string): Promise<string> {
    return this.oneTimeTokens.consume(purpose, token);
  }
}
