import { z } from 'zod';

export const lastTripScoreSchema = z.object({
  score: z.number().meta({ example: 90.4 }),
  previousAverage: z
    .number()
    .nullable()
    .meta({ description: 'Average score of the 5 completed trips before the last one; null on the first trip', example: 85.6 }),
  change: z.number().nullable().meta({ description: 'score minus previousAverage; null on the first trip', example: 4.8 }),
});
export type LastTripScoreDto = z.infer<typeof lastTripScoreSchema>;