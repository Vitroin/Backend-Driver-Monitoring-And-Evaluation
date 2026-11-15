import { z } from 'zod';
import { IncidentType } from '@common/enums';

const statSchema = z.object({
  count: z.number().int().meta({ example: 3 }),
  pointsDeducted: z.number().meta({ example: 8.4 }),
});

export const incidentStatsSchema = z.object({
  total: statSchema,
  byType: z.array(statSchema.extend({ type: z.enum(IncidentType) })).meta({ description: 'Every type, 0 when it did not happen' }),
});
export type IncidentStatsDto = z.infer<typeof incidentStatsSchema>;