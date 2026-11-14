import { IncidentSeverity } from '@common/enums';
import { objectIdSchema } from '@common/types';
import { z } from 'zod';

export const myIncidentsQuerySchema = z.strictObject({
  // Only this trip's incidents (Trip Report)
  tripId: objectIdSchema.optional(),

  // Only the last N days (Main Dashboard = 60, car widget / major events = 21). Omit for all time
  sinceDays: z.coerce.number().int().min(1).max(365).optional(),

  // Comma-separated: ?severity=medium,high
  severity: z
    .string()
    .transform((v) => v.split(',').map((s) => s.trim()))
    .pipe(z.array(z.enum(IncidentSeverity)))
    .optional(),

  // How many incidents to return in the list. The counts always cover ALL matching incidents
  limit: z.coerce.number().int().min(1).max(50).default(5),
});

export type MyIncidentsQueryDto = z.infer<typeof myIncidentsQuerySchema>;