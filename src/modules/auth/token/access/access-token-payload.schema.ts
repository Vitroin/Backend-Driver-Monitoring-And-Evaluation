import { objectIdSchema } from '@common';
import { z } from 'zod';

/** Claims put into every access token. `sid` is also the id of the refresh token issued alongside it. */
export const accessTokenClaimsSchema = z.object({
  sid: objectIdSchema,
  userId: objectIdSchema,
  securityStamp: objectIdSchema,
});
export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;

/** A verified access token's payload. Parsing it rejects correctly signed tokens that are missing claims. */
export const accessTokenPayloadSchema = accessTokenClaimsSchema.extend({
  iat: z.number(),
  exp: z.number(),
});
export type AccessTokenPayload = z.infer<typeof accessTokenPayloadSchema>;
