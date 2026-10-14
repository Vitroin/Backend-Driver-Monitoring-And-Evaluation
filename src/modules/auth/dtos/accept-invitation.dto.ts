import { z } from 'zod';
import { confirmPasswordSchema, newPasswordSchema, oneTimeTokenSchema, passwordsMatch } from './password.schema';

export const acceptInvitationSchema = z
  .strictObject({
    token: oneTimeTokenSchema.meta({ description: 'Activation token from the invitation email' }),
    password: newPasswordSchema,
    confirmPassword: confirmPasswordSchema,
  })
  .refine(...passwordsMatch('password'));

export type AcceptInvitationDto = z.infer<typeof acceptInvitationSchema>;
