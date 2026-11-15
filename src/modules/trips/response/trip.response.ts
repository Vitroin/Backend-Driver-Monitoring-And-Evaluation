import { z } from 'zod';
import { IncidentSeverity, IncidentType, TripRisk, TripStatus } from '@common/enums';
import { objectIdSchema } from '@common/types';

// One trip's overall stats (trip report dashboard)
export const tripOverallSchema = z.object({
  startedAt: z.iso.datetime().meta({ example: '2026-10-08T12:18:00.000Z' }),
  vehicle: z.string().meta({ example: 'Kart GK-01' }),
  driverName: z
    .string()
    .nullable()
    .meta({ description: 'null if the driver account no longer exists', example: 'Ahmed Ali' }),
  durationSeconds: z.number().nullable().meta({ description: 'null until the trip is processed', example: 1380 }),
  distanceKm: z.number().nullable().meta({ description: 'null until the trip is processed', example: 5.8 }),
  averageSpeedKmh: z.number().nullable().meta({ example: 32.4 }),
  topSpeedKmh: z.number().nullable().meta({ example: 58 }),
  eventsCount: z.number().nullable().meta({ description: 'Incidents that count toward the score', example: 4 }),
  score: z.number().nullable().meta({ description: 'null until the trip is processed', example: 90.4 }),
  risk: z.enum(TripRisk).nullable(),
});
export type TripOverallDto = z.infer<typeof tripOverallSchema>;

// A trip in the filtered trips list, with its incidents
export const filteredTripIncidentSchema = z.object({
  _id: objectIdSchema.meta({ example: '9f3175354c863c635b87ad30' }),
  type: z.enum(IncidentType),
  severity: z.enum(IncidentSeverity),
  occurredAt: z.iso.datetime().meta({ example: '2026-10-02T12:49:00.000Z' }),
  clipUrl: z.string().nullable(),
  pointsDeducted: z.number().meta({ description: 'Positive; shown as -5.6', example: 5.6 }),
});

export const filteredTripSchema = z.object({
  _id: objectIdSchema.meta({ example: '9f3175354c863c635b87ad30' }),
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

export const paginationSchema = z.object({
  page: z.number().int().meta({ example: 1 }),
  limit: z.number().int().meta({ example: 20 }),
  total: z.number().int().meta({ description: 'Trips matching the filters, across all pages', example: 57 }),
  totalPages: z.number().int().meta({ example: 3 }),
});
export type PaginationDto = z.infer<typeof paginationSchema>;

// The filtered trips list: one page of trips plus where it sits in the whole result
export const filteredTripsPageSchema = z.object({
  trips: z.array(filteredTripSchema),
  pagination: paginationSchema,
});
export type FilteredTripsPageDto = z.infer<typeof filteredTripsPageSchema>;