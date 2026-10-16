import { z } from 'zod';
import { IncidentSeverity, IncidentType, TripStatus } from '@common/enums';
import { objectIdSchema } from '@common/types';

export const filteredTripIncidentSchema = z.object({
  _id: objectIdSchema.meta({ example: '665f1c2e8b3e4a1d2c9f0a12' }),
  type: z.enum(IncidentType),
  severity: z.enum(IncidentSeverity),
  occurredAt: z.iso.datetime().meta({ example: '2026-10-02T12:49:00.000Z' }),
  clipUrl: z.string().nullable(),
  pointsDeducted: z.number().meta({ description: 'Positive; shown as -5.6', example: 5.6 }),
});

export const filteredTripSchema = z.object({
  _id: objectIdSchema.meta({ example: '665f1c2e8b3e4a1d2c9f0a12' }),
  code: z.string().meta({ example: 'T-24013' }),
  vehicle: z.string().meta({ example: 'Kart GK-01' }),
  status: z.enum(TripStatus),
  startedAt: z.iso.datetime().meta({ example: '2026-10-08T12:18:00.000Z' }),
  speedLimitKmh: z.number().nullable().meta({ example: 50 }),
  durationSeconds: z.number().nullable().meta({ description: 'null until the trip is processed', example: 1380 }),
  distanceKm: z.number().nullable().meta({ description: 'null until the trip is processed', example: 5.8 }),
  averageSpeedKmh: z.number().nullable().meta({ example: 32.4 }),
  topSpeedKmh: z.number().nullable().meta({ example: 58 }),
  eventsCount: z.number().nullable().meta({ example: 4 }),
  score: z.number().nullable().meta({ description: 'null until the trip is processed', example: 90.4 }),
  incidents: z
    .array(filteredTripIncidentSchema)
    .meta({ description: 'Chronological; only incidents of `eventType` when that filter is set' }),
});
export type FilteredTripDto = z.infer<typeof filteredTripSchema>;
