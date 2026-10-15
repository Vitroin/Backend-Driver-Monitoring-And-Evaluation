import { z } from 'zod';

export const tripTotalsSchema = z.object({
  trips: z.number().int().meta({ description: 'Completed trips', example: 13 }),
  distanceKm: z.number().meta({ example: 104.9 }),
  durationSeconds: z.number().int().meta({ description: 'Total driving time; the client formats it, e.g. 15480 -> "4.3 hrs"', example: 15480 }),
});
export type TripTotalsDto = z.infer<typeof tripTotalsSchema>;