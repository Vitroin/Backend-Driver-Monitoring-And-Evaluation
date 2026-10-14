export const JWT_ALGORITHM = 'HS256';
export const JWT_ISSUER = 'sahi-api';
export const JWT_AUDIENCE = 'sahi-web';


/** What a single-use token authorizes. Each purpose has its own cache key space and lifetime. */
export enum OneTimeTokenPurpose {
  FORCED_PASSWORD_CHANGE = 'forced_password_change',
  ACCOUNT_ACTIVATION = 'account_activation',
}

/** Lifetime of each kind of single-use token, in seconds. */
export const ONE_TIME_TOKEN_TTL_SECONDS: Record<OneTimeTokenPurpose, number> = {
  [OneTimeTokenPurpose.FORCED_PASSWORD_CHANGE]: 15 * 60, // 15 minutes
  [OneTimeTokenPurpose.ACCOUNT_ACTIVATION]: 8 * 60 * 60, // 8 hours
};
