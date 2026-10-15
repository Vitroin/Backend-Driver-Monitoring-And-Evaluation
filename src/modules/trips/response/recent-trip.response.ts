import { z } from 'zod';
import { TripRisk, TripStatus } from '@common/enums';

export const recentTripSchema = z.object({
  code: z.string().meta({ description: 'Used in the trip link, e.g. /trips/T-24013', example: 'T-24013' }),
  vehicle: z.string().meta({ example: 'Kart GK-01' }),
  status: z.enum(TripStatus),
  startedAt: z.iso.datetime().meta({ example: '2026-10-08T12:18:00.000Z' }),
  distanceKm: z.number().nullable().meta({ description: 'null until the trip is processed', example: 5.8 }),
  score: z.number().nullable().meta({ description: 'null until the trip is processed', example: 90.4 }),
  risk: z.enum(TripRisk).nullable(),
});
export type RecentTripDto = z.infer<typeof recentTripSchema>;