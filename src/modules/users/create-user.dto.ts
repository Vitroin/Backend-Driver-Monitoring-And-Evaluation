import { Gender, UserRole } from '@common/enums';
import { emailSchema, fullNameSchema, objectIdSchema } from '@common/types';
import { z } from 'zod';

export const MIN_USER_AGE = 18;
export const MAX_USER_AGE = 100;

export const CreateUserSchema = z.strictObject({
  email: emailSchema,
  fullName: fullNameSchema,
  gender: z.enum(Gender, { message: 'Gender must be male or female' }),
  age: z
    .number()
    .int()
    .min(MIN_USER_AGE)
    .max(MAX_USER_AGE)
    .meta({ description: `Age must be between ${MIN_USER_AGE} and ${MAX_USER_AGE}` }),
  organization: objectIdSchema.meta({ description: 'Organization ID' }),
  role: z.enum(UserRole, { message: `Role must be one of: ${Object.values(UserRole).join(', ')}` }),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
