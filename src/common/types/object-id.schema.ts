import { z } from 'zod';

export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, { message: 'Must be a valid ID' });

export const idParamSchema = z.object({ id: objectIdSchema });
export type IdParam = z.infer<typeof idParamSchema>;