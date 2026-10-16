import { z } from 'zod';
import { TripRisk } from '@common/enums';

export const tripOverallSchema = z.object({
  durationMs: z.number().nullable().meta({ description: 'null until the trip is processed', example: 1_380_000 }),
  distanceKm: z.number().nullable().meta({ description: 'null until the trip is processed', example: 5.8 }),
  averageSpeedKmh: z.number().nullable().meta({ example: 32.4 }),
  topSpeedKmh: z.number().nullable().meta({ example: 58 }),
  eventsCount: z.number().nullable().meta({ description: 'Incidents that count toward the score', example: 4 }),
  score: z.number().nullable().meta({ description: 'null until the trip is processed', example: 90.4 }),
  risk: z.enum(TripRisk).nullable(),
});
export type TripOverallDto = z.infer<typeof tripOverallSchema>;
