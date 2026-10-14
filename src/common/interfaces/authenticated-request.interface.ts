import type { UserDocument } from '@modules/users/user.model';
import type { Request } from 'express';

export interface RequestSession {
  sid: string;
  /** Access token expiry, seconds since the epoch. */
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  user: UserDocument;
  session: RequestSession;
}