import { usernameSchema } from '@common/types';
import { z } from 'zod';

export const forgotPasswordSchema = z.strictObject({
  username: usernameSchema,
});

export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;