import { z } from 'zod';
import { TripRisk } from '@common/enums';
import { objectIdSchema } from '@common/types';

export const scorePointSchema = z.object({
  tripId: objectIdSchema.meta({ example: '665f1c2e8b3e4a1d2c9f0a12' }),
  code: z.string().meta({ example: 'T-24013' }),
  score: z.number().meta({ example: 90.4 }),
  startedAt: z.iso.datetime().meta({ example: '2026-10-08T09:18:00.000Z' }),
});

export const scoreOverviewSchema = z.object({
  longTermScore: z
    .number()
    .nullable()
    .meta({ description: 'Mean of trip scores weighted by duration and recency; null before the first completed trip', example: 79.4 }),
  riskLevel: z.enum(TripRisk).nullable(),
  history: z.array(scorePointSchema).meta({ description: 'One point per completed trip, oldest first' }),
});
export type ScoreOverviewDto = z.infer<typeof scoreOverviewSchema>;