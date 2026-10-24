import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { TokenExpiredError } from 'jsonwebtoken';
import { UserStatus } from '@common/enums';
import type { RequestSession } from '@common/interfaces';
import { UsersService } from '@modules/users/users.service';
import type { UserDocument } from '@modules/users/user.model';
import { TokenService } from './token/token.service';
import { AccessTokenPayload, accessTokenPayloadSchema } from './token/access/access-token-payload.schema';

const BEARER_PATTERN = /^Bearer\s+(\S+)$/i;
const INVALID_TOKEN = 'Invalid token. Please login again';

/**
 * Turns an `Authorization: Bearer <token>` value into the logged-in user. Used by AuthenticationGuard for HTTP
 * requests and by the notifications gateway when a socket connects, so both check a token the same way.
 */
@Injectable()
export class Authenticator {
  constructor(
    private readonly tokenService: TokenService,
    private readonly usersService: UsersService,
  ) {}

  /** @throws UnauthorizedException (401) for a missing, malformed, expired or revoked token; ForbiddenException (403) for an inactive user. */
  async authenticate(authorization: string | undefined): Promise<{ user: UserDocument; session: RequestSession }> {
    if (!authorization) throw new UnauthorizedException('Authorization token is required');

    const token = BEARER_PATTERN.exec(authorization)?.[1];
    if (!token) throw new UnauthorizedException('Invalid token format. Please login again');

    const payload = this.verify(token);
    if (await this.tokenService.isAccessTokenBlocked(payload.sid)) throw new UnauthorizedException(INVALID_TOKEN);

    // The security stamp changes on password change and "log out everywhere", which invalidates older tokens.
    const user = await this.usersService.findForAuthentication(payload.userId);
    if (!user || !user.securityStamp.equals(payload.securityStamp)) throw new UnauthorizedException(INVALID_TOKEN);
    if (user.status !== UserStatus.ACTIVE) throw new ForbiddenException('Account is not active. Please contact system administrator');
    if (user.mustChangePassword) throw new ForbiddenException('Password change required. Please change your password to continue');

    return { user, session: { sid: payload.sid, exp: payload.exp } };
  }

  /** Checks the signature and expiry, then the claims. Every failure is a 401 so the client knows to refresh or log in. */
  private verify(token: string): AccessTokenPayload {
    let decoded: unknown;
    try {
      decoded = this.tokenService.verifyAccessToken(token);
    } catch (error) {
      if (error instanceof TokenExpiredError) throw new UnauthorizedException('Token has expired. Please login again');
      throw new UnauthorizedException(INVALID_TOKEN);
    }
    const payload = accessTokenPayloadSchema.safeParse(decoded);
    if (!payload.success) throw new UnauthorizedException(INVALID_TOKEN);
    return payload.data;
  }
}
