import { IncidentType, TripStatus } from '@common/enums';
import { objectIdSchema } from '@common/types';
import { z } from 'zod';

const dateTimeSchema = z.iso
  .datetime({ offset: true })
  .transform((v) => new Date(v))
  .optional();

const fromBeforeTo = <T extends { from?: Date; to?: Date }>({ from, to }: T) => (from && to ? from <= to : true);
const fromBeforeToError = { message: '`from` must be before `to`', path: ['from'] };

// "me" is an alias for the logged-in user
export const driverIdSchema = z.union([z.literal('me'), objectIdSchema]);

export const TRIP_SORTS = ['startedAt', '-startedAt', 'score', '-score'] as const;
export type TripSort = (typeof TRIP_SORTS)[number];

// GET /trips
export const tripsListQuerySchema = z
  .strictObject({
    driverId: driverIdSchema.optional().meta({
      description: 'Drivers always get their own trips; organization staff can narrow the list to one driver',
    }),
    status: z.enum(TripStatus).optional(),
    eventType: z.enum(IncidentType).optional().meta({ description: 'Only trips with at least one incident of this type' }),
    from: dateTimeSchema,
    to: dateTimeSchema,
    include: z.enum(['incidents']).optional().meta({ description: "Embed each trip's incidents" }),
    sort: z.enum(TRIP_SORTS).default('-startedAt'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine(fromBeforeTo, fromBeforeToError);
export type TripsListQueryDto = z.infer<typeof tripsListQuerySchema>;

// GET /trips/:tripId/telemetry
export const TELEMETRY_CHANNELS = ['speed', 'acceleration', 'steering'] as const;
export type TelemetryChannel = (typeof TELEMETRY_CHANNELS)[number];

export const telemetryQuerySchema = z.strictObject({
  channels: z
    .string()
    .default(TELEMETRY_CHANNELS.join(','))
    .transform((v) => [...new Set(v.split(',').map((s) => s.trim()).filter(Boolean))])
    .pipe(z.array(z.enum(TELEMETRY_CHANNELS)).min(1))
    .meta({ description: 'Comma-separated: speed, acceleration, steering. Defaults to all three', example: 'speed,steering' }),
});
export type TelemetryQueryDto = z.infer<typeof telemetryQuerySchema>;

// GET /drivers/:driverId/stats
export const driverStatsQuerySchema = z.strictObject({
  window: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(5)
    .meta({ description: 'How many trips the recent / first / previous averages use' }),
});
export type DriverStatsQueryDto = z.infer<typeof driverStatsQuerySchema>;

// GET /drivers/:driverId/score-history
export const scoreHistoryQuerySchema = z
  .strictObject({ from: dateTimeSchema, to: dateTimeSchema })
  .refine(fromBeforeTo, fromBeforeToError);
export type ScoreHistoryQueryDto = z.infer<typeof scoreHistoryQuerySchema>;