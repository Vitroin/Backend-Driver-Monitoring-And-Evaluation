import { z } from 'zod';

export const studentAssignedResponseSchema = z.object({
  message: z.string().meta({ example: 'Driver assigned to instructor successfully' }),
});
