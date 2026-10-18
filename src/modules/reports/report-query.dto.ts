import { z } from 'zod';

export const reportLanguageQuerySchema = z.strictObject({
  language: z.enum(['en', 'ar']).default('en'),
});
export type ReportQueryDto = z.infer<typeof reportLanguageQuerySchema>;
