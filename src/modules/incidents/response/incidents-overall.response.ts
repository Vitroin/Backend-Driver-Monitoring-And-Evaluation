import { IncidentSeverity, IncidentType } from '@common/enums';
import { objectIdSchema } from '@common/types';
import { z } from 'zod';

export const incidentItemSchema = z.object({
  id: objectIdSchema.meta({ example: '9f3175354c863c635b87ad30' }),
  tripId: objectIdSchema.meta({ example: '6ad24e609609bf3649c97cdf' }),
  type: z.enum(IncidentType),
  severity: z.enum(IncidentSeverity),
  occurredAt: z.iso.datetime().meta({ example: '2026-10-02T12:49:00.000Z' }),
  location: z
    .object({ latitude: z.number(), longitude: z.number() })
    .nullable()
    .meta({ description: 'null when no GPS fix was recorded' }),
  speedKmh: z.number().nullable(),
  clipUrl: z.string().nullable(),
  pointsDeducted: z.number().meta({ description: 'Positive; shown as -23.8', example: 23.8 }),
});

export const incidentTypeCountSchema = z.object({
  type: z.enum(IncidentType),
  count: z.number().meta({ example: 6 }),
  pointsLost: z.number().meta({ example: 18.4 }),
});

export const incidentsOverviewSchema = z.object({
  incidents: z.array(incidentItemSchema).meta({ description: 'Most points deducted first, at most `limit`' }),
  total: z.number().meta({ description: 'All matching incidents, not just the ones returned', example: 17 }),
  byType: z.array(incidentTypeCountSchema).meta({ description: 'All matching incidents per type, most points lost first' }),
});

export type IncidentItemDto = z.infer<typeof incidentItemSchema>;
export type IncidentsOverviewDto = z.infer<typeof incidentsOverviewSchema>;