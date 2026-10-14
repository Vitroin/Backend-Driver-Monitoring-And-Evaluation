import { z } from 'zod';
import { confirmPasswordSchema, existingPasswordSchema, newPasswordSchema, otpSchema, passwordsMatch } from './password.schema';

export const changePasswordSchema = z
  .strictObject({
    currentPassword: existingPasswordSchema.meta({ description: 'Current user password', example: 'MyCurrentSecurePassword123' }),
    newPassword: newPasswordSchema,
    confirmPassword: confirmPasswordSchema,
    otp: otpSchema.optional().meta({ description: 'Required for super admins: send the request once without it to receive the code' }),
  })
  .refine(...passwordsMatch('newPassword'))
  // The current password is verified against the stored hash first, so comparing the inputs is enough here.
  .refine((data) => data.newPassword !== data.currentPassword, { message: 'New password must differ from the current one', path: ['newPassword'] });

export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
