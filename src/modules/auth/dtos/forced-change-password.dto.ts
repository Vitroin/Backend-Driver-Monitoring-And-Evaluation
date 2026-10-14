import { z } from 'zod';
import { confirmPasswordSchema, newPasswordSchema, oneTimeTokenSchema, passwordsMatch } from './password.schema';

export const forcedPasswordChangeSchema = z
  .strictObject({
    token: oneTimeTokenSchema.meta({ description: 'The passwordChangeToken returned by POST /auth/login' }),
    newPassword: newPasswordSchema,
    confirmPassword: confirmPasswordSchema,
  })
  .refine(...passwordsMatch('newPassword'));

export type ForcedPasswordChangeDto = z.infer<typeof forcedPasswordChangeSchema>;
