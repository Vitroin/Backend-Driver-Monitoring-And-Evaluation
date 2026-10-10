import { z } from 'zod';

export const ResetPasswordSchema = z.object({
  username: z.string().trim().toLowerCase().min(3),
  otp: z.string().regex(/^\d{6}$/, { message: 'Code must be 6 digits' }),
  newPassword: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters long' })
    .max(72, { message: 'Password must be at most 72 characters long' })
    .regex(/[A-Z]/, { message: 'Password must contain an uppercase letter' })
    .regex(/[a-z]/, { message: 'Password must contain a lowercase letter' })
    .regex(/[0-9]/, { message: 'Password must contain a number' }),
});

export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;