import { usernameSchema } from '@common/types';
import { z } from 'zod';
import { confirmPasswordSchema, newPasswordSchema, otpSchema, passwordsMatch } from './password.schema';

export const resetPasswordSchema = z
  .strictObject({
    username: usernameSchema,
    otp: otpSchema,
    newPassword: newPasswordSchema,
    confirmPassword: confirmPasswordSchema,
  })
  .refine(...passwordsMatch('newPassword'));

export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;