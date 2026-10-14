import { usernameSchema } from '@common/types';
import { z } from 'zod';
import { existingPasswordSchema } from './password.schema';

export const loginSchema = z.strictObject({
  username: usernameSchema,
  password: existingPasswordSchema.meta({ description: 'User password', example: 'MySecurePassword123' }),
});

export type LoginDto = z.infer<typeof loginSchema>;