import { z } from 'zod';
import { TripRisk } from '@common/enums';

// A driver's headline numbers: the dashboard's score ring and cards, and the progress page
export const driverStatsSchema = z.object({
  totals: z.object({
    trips: z.number().int().meta({ description: 'Completed, scored trips', example: 13 }),
    distanceKm: z.number().meta({ example: 104.9 }),
    durationSeconds: z.number().int().meta({ description: 'Total driving time; the client formats it, e.g. 15480 -> "4.3 hrs"', example: 15480 }),
  }),
  lastTripScore: z.number().nullable().meta({ description: "The latest scored trip's score", example: 90.4 }),
  lastTripDifference: z
    .number()
    .nullable()
    .meta({ description: 'lastTripScore minus recentAverage; null without a scored trip', example: 3.2 }),
  recentAverage: z.number().nullable().meta({ description: 'Average of the 5 latest scored trips', example: 87.2 }),
  changeSinceStart: z
    .number()
    .nullable()
    .meta({ description: 'recentAverage minus the average of the 5 first scored trips', example: 6.8 }),
  longTermScore: z
    .number()
    .nullable()
    .meta({ description: 'Mean of trip scores weighted by duration and recency (SRS §8.4)', example: 84.1 }),
  risk: z.enum(TripRisk).nullable().meta({ description: 'The risk level of longTermScore' }),
  bestTripScore: z.number().nullable().meta({ example: 98.5 }),
});
export type DriverStatsDto = z.infer<typeof driverStatsSchema>;
