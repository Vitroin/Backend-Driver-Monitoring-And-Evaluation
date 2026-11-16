import { fullNameSchema } from '@common/types';
import { z } from 'zod';

export const updateFullNameSchema = z.strictObject({
  fullName: fullNameSchema,
});

export type UpdateFullNameDto = z.infer<typeof updateFullNameSchema>;
