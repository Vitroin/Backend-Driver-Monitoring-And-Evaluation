import { z } from 'zod';

export const fullNameResponseSchema = z.object({
  fullName: z.string().meta({ example: 'Youssef Nabil' }),
});
export type FullNameResponseDto = z.infer<typeof fullNameResponseSchema>;
