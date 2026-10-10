import { Roles } from '@common/enums/roles.enum';
import { z } from 'zod';

export const CreateUserSchema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(30),
  
  email: z
    .email({ message: 'Email must be a valid email address' })
    .trim()
    .toLowerCase(),

  gender: z.enum(['male', 'female'], { message: 'Gender must be male or female' }),

  age: z
    .number({ message: 'Age is required and must be a number' })
    .int({ message: 'Age must be a whole number' })
    .min(16, { message: 'Age must be at least 16' })
    .max(100, { message: 'Age must be at most 100' }),

  organization: z.string().regex(/^[0-9a-fA-F]{24}$/, { message: 'Organization must be a valid ID' }),
  
  role: z.enum(Roles, { message: `Role must be one of: ${Object.values(Roles).join(', ')}` }),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;