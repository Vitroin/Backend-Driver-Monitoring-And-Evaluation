import { IncidentSeverity, IncidentType } from '@common/enums';
import { z } from 'zod';

const maxPointsSchema = z.coerce
  .number()
  .int()
  .min(2)
  .max(10_000)
  .default(2_000)
  .meta({ description: 'About how many route points to return; long trips are downsampled, keeping every point where the speed colour changes' });

const dateTimeSchema = z.iso
  .datetime({ offset: true })
  .transform((v) => new Date(v))
  .optional();

export const tripRouteQuerySchema = z
  .strictObject({
    from: dateTimeSchema,
    to: dateTimeSchema,
    maxPoints: maxPointsSchema,
  })
  .refine(({ from, to }) => (from && to ? from <= to : true), {
    message: '`from` must be before `to`',
    path: ['from'],
  });
export type TripRouteQueryDto = z.infer<typeof tripRouteQuerySchema>;

export const tripIncidentsQuerySchema = z.strictObject({
  eventType: z.enum(IncidentType).optional(),
  severity: z.enum(IncidentSeverity).optional(),
});
export type TripIncidentsQueryDto = z.infer<typeof tripIncidentsQuerySchema>;

export const tripMapQuerySchema = z.strictObject({
  maxPoints: maxPointsSchema,
});
export type TripMapQueryDto = z.infer<typeof tripMapQuerySchema>;
