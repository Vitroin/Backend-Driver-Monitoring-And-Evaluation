import { z } from 'zod';

// A driver's totals over their completed, scored trips (main dashboard)
export const tripTotalsSchema = z.object({
  trips: z.number().int().meta({ description: 'Completed trips', example: 13 }),
  distanceKm: z.number().meta({ example: 104.9 }),
  durationSeconds: z
    .number()
    .int()
    .meta({ description: 'Total driving time; the client formats it, e.g. 15480 -> "4.3 hrs"', example: 15480 }),
  lastTripScore: z.number().nullable().meta({ description: 'The most recent scored trip; null when there is none', example: 90.4 }),
  difference: z.number().nullable().meta({
    description: 'lastTripScore minus the average of the last 5 scored trips; null when lastTripScore is null',
    example: 3.2,
  }),
});
export type TripTotalsDto = z.infer<typeof tripTotalsSchema>;