import { z } from 'zod';
import { IncidentSeverity, IncidentType } from '@common/enums';
import { objectIdSchema } from '@common/types';

export const tripIncidentSchema = z.object({
  _id: objectIdSchema.meta({ example: '665f1c2e8b3e4a1d2c9f0a12' }),
  type: z.enum(IncidentType),
  severity: z.enum(IncidentSeverity),
  occurredAt: z.iso.datetime().meta({ example: '2026-10-02T12:49:00.000Z' }),
  location: z
    .object({
      latitude: z.number().min(-90).max(90).meta({ example: 31.2001 }),
      longitude: z.number().min(-180).max(180).meta({ example: 29.9187 }),
    })
    .nullable()
    .meta({ description: 'null when no GPS fix was recorded' }),
  speedKmh: z.number().nullable().meta({ description: 'null when not recorded', example: 36 }),
  clipUrl: z.string().nullable(),
  pointsDeducted: z.number().meta({ description: 'Positive; shown as -5.6', example: 5.6 }),
});

export const tripIncidentsSchema = z.object({
  incidents: z.array(tripIncidentSchema).meta({ description: 'Most points deducted first' }),
});
export type TripIncidentsDto = z.infer<typeof tripIncidentsSchema>;

// Count and points lost for one incident type; every type is listed, with 0 for the ones that didn't happen
export const incidentTypeSummarySchema = z.object({
  type: z.enum(IncidentType),
  count: z.number().int().meta({ example: 3 }),
  totalDeduction: z.number().meta({ description: 'Points lost to this type, positive', example: 12.4 }),
});
export type IncidentTypeSummaryDto = z.infer<typeof incidentTypeSummarySchema>;
