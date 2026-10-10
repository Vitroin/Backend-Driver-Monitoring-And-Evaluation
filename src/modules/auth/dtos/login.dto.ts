import { z } from 'zod';

export const LoginSchema = z.object({
  username: z.string({ message: 'Username is required' }).toLowerCase().min(3, { message: 'Username must be at least 3 characters long' }),
  password: z.string({ message: 'Password is required' }).min(8, { message: 'Password must be at least 8 characters long' }),
});

export type LoginDto = z.infer<typeof LoginSchema>;
