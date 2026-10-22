import { UserRole } from '@common/enums';
import { emailSchema, fullNameSchema, objectIdSchema } from '@common/types';
import { z } from 'zod';

export const CreateUserSchema = z.strictObject({
  email: emailSchema,
  fullName: fullNameSchema,
  gender: z.enum(['male', 'female'], { message: 'Gender must be male or female' }),
  age: z
    .number({ message: 'Age is required and must be a number' })
    .int({ message: 'Age must be a whole number' })
    .min(16, { message: 'Age must be at least 16' })
    .max(100, { message: 'Age must be at most 100' }),
  organization: objectIdSchema.meta({ description: 'Organization ID' }),
  role: z.enum(UserRole, { message: `Role must be one of: ${Object.values(UserRole).join(', ')}` }),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
