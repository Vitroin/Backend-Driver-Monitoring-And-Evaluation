import { z } from 'zod';

export const driverIncidentsQuerySchema = z.strictObject({
  days: z.coerce.number().int().min(1).max(365).default(60).meta({ description: 'How many days back' }),
  sort: z
    .enum(['-occurredAt', '-pointsDeducted'])
    .default('-occurredAt')
    .meta({ description: '`-occurredAt`: newest first; `-pointsDeducted`: the costliest first ("most significant events")' }),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type DriverIncidentsQueryDto = z.infer<typeof driverIncidentsQuerySchema>;

export const driverIncidentsSummaryQuerySchema = z.strictObject({
  days: z.coerce.number().int().min(1).max(3650).optional().meta({ description: 'How many days back; all time when left out' }),
});
export type DriverIncidentsSummaryQueryDto = z.infer<typeof driverIncidentsSummaryQuerySchema>;
