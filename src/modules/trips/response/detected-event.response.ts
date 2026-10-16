import { z } from 'zod';
import { IncidentSeverity, IncidentType } from '@common/enums';

export const detectedEventSchema = z.object({
  type: z.enum(IncidentType),
  severity: z.enum(IncidentSeverity),
  occurredAt: z.iso.datetime().meta({ example: '2026-10-02T12:49:00.000Z' }),
  pointsDeducted: z.number().meta({ description: 'Positive; shown as -5.6', example: 5.6 }),
});
export type DetectedEventDto = z.infer<typeof detectedEventSchema>;
