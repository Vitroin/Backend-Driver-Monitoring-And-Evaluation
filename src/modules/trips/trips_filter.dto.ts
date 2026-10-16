import { IncidentType, TripStatus } from '@common/enums';
import { z } from 'zod';

export const tripsFilterSchema = z
  .strictObject({
    status: z.enum(TripStatus).optional(),
    eventType: z.enum(IncidentType).optional(),
    from: z.iso
      .datetime({ offset: true })
      .transform((v) => new Date(v))
      .optional(),
    to: z.iso
      .datetime({ offset: true })
      .transform((v) => new Date(v))
      .optional(),

    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine(({ from, to }) => (from && to ? from <= to : true), {
    message: '`from` must be before `to`',
    path: ['from'],
  });
  
export type TripsFilterDto = z.infer<typeof tripsFilterSchema>;
