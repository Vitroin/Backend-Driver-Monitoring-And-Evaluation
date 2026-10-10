import { z } from 'zod';

export const ForgetPasswordSchema = z.object({
  username: z
    .string({ message: 'Username is required' })
    .trim()
    .toLowerCase()
    .min(3, { message: 'Username must be at least 3 characters long' }),
});

export type ForgetPasswordDto = z.infer<typeof ForgetPasswordSchema>;