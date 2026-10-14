import { z } from 'zod';

export const refreshTokenSchema = z.strictObject({
  refreshToken: z
    .string()
    .min(1, { message: 'Refresh token is required' })
    .max(256)
    .meta({ description: 'The refresh token from login or from the previous refresh' }),
});

export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;
