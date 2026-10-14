import { usernameSchema } from '@common/types';
import { z } from 'zod';
import { otpSchema } from './password.schema';

export const validateResetPasswordOtpSchema = z.strictObject({
  username: usernameSchema,
  otp: otpSchema,
});

export type ValidateResetPasswordOtpDto = z.infer<typeof validateResetPasswordOtpSchema>;