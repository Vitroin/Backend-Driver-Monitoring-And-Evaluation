import type { UserDocument } from '@modules/users/user.model';
import type { FastifyRequest } from 'fastify';

export interface RequestSession {
  sid: string;
  /** Access token expiry, seconds since the epoch. */
  exp: number;
}

export interface AuthenticatedRequest extends FastifyRequest {
  user: UserDocument;
  session: RequestSession;
}