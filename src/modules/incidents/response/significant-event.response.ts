import { z } from 'zod';
import { IncidentSeverity, IncidentType } from '@common/enums';
import { objectIdSchema } from '@common/types';

// One of a driver's incidents, across their trips (e.g. "Most significant events": ?sort=-pointsDeducted&limit=5)
export const driverIncidentSchema = z.object({
  id: objectIdSchema.meta({ example: '665f1c2e8b3e4a1d2c9f0a12' }),
  tripId: objectIdSchema.meta({ example: '6ad24e609609bf3649c97cdf' }),
  type: z.enum(IncidentType),
  severity: z.enum(IncidentSeverity),
  occurredAt: z.iso.datetime().meta({ example: '2026-10-02T12:49:00.000Z' }),
  pointsDeducted: z.number().meta({ description: 'Positive; shown as -23.8', example: 23.8 }),
});
export type DriverIncidentDto = z.infer<typeof driverIncidentSchema>;
