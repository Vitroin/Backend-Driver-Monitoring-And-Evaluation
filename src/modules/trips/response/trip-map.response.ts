import { z } from 'zod';
import {
  IncidentCategory,
  IncidentSeverity,
  IncidentType,
  SpeedCategory,
  SpeedLimitSource,
  TripStatus,
} from '@common/enums';
import { objectIdSchema } from '@common/types';

const offsetSecondsSchema = z.number().meta({ description: 'Seconds since the trip started', example: 132.5 });
const latitudeSchema = z.number().min(-90).max(90).meta({ example: 31.2001 });
const longitudeSchema = z.number().min(-180).max(180).meta({ example: 29.9187 });

export const routePointSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  recordedAt: z.iso.datetime().meta({ example: '2026-10-16T12:02:12.500Z' }),
  offsetSeconds: offsetSecondsSchema,
  speedKmh: z.number().nullable().meta({ description: 'null when the reading is missing', example: 36 }),
  speedLimitKmh: z.number().nullable().meta({ example: 35 }),
  speedLimitSource: z.enum(SpeedLimitSource).nullable().meta({
    description: '`route`: recorded for this location; `trip`: the limit set when the trip was planned; null: no limit known',
  }),
  headingDeg: z.number().nullable().meta({ description: 'Degrees clockwise from north', example: 87 }),
  speedCategory: z.enum(SpeedCategory).meta({ description: '`unknown` when the speed or the limit is missing' }),
});
export type RoutePointDto = z.infer<typeof routePointSchema>;

export const routeSegmentSchema = z.object({
  speedCategory: z.enum(SpeedCategory),
  startIndex: z.number().int().meta({ example: 0 }),
  endIndex: z.number().int().meta({ description: "Inclusive; it is also the next segment's startIndex, so the lines join", example: 14 }),
});

export const tripRouteSchema = z.object({
  points: z.array(routePointSchema).meta({ description: 'Chronological' }),
  segments: z.array(routeSegmentSchema).meta({
    description: 'Draw points[startIndex..endIndex] of each segment as one polyline in its speedCategory colour',
  }),
  totalPoints: z.number().int().meta({ description: 'GPS points in the requested range, before downsampling', example: 5400 }),
  downsampled: z.boolean(),
});
export type TripRouteDto = z.infer<typeof tripRouteSchema>;

export const incidentMarkerSchema = z.object({
  id: objectIdSchema.meta({ example: '665f1c2e8b3e4a1d2c9f0a12' }),
  type: z.enum(IncidentType),
  category: z.enum(IncidentCategory).meta({ description: 'Timeline row' }),
  severity: z.enum(IncidentSeverity),
  occurredAt: z.iso.datetime().meta({ example: '2026-10-16T12:02:12.000Z' }),
  offsetSeconds: offsetSecondsSchema,
  location: z
    .object({ latitude: latitudeSchema, longitude: longitudeSchema })
    .nullable()
    .meta({ description: 'null when no GPS fix was recorded: show it on the timeline, not on the map' }),
  speedKmh: z.number().nullable().meta({ description: 'Vehicle speed at the time; null when not recorded', example: 36 }),
  speedLimitKmh: z.number().nullable().meta({ description: "The trip's speed limit", example: 35 }),
  pointsDeducted: z.number().meta({ description: 'Positive; shown as -5.6', example: 5.6 }),
  clipUrl: z.string().nullable().meta({ description: 'Short video clip of the event, when one was uploaded' }),
});
export type IncidentMarkerDto = z.infer<typeof incidentMarkerSchema>;

export const timelineEventSchema = z.object({
  incidentId: objectIdSchema.meta({ example: '665f1c2e8b3e4a1d2c9f0a12' }),
  type: z.enum(IncidentType),
  severity: z.enum(IncidentSeverity),
  occurredAt: z.iso.datetime().meta({ example: '2026-10-16T12:02:12.000Z' }),
  offsetSeconds: offsetSecondsSchema,
  durationSeconds: z.number().nullable().meta({
    description: 'null: incidents are recorded as a single moment, not an interval',
  }),
});
export type TimelineEventDto = z.infer<typeof timelineEventSchema>;

export const tripMapSchema = z.object({
  trip: z.object({
    id: objectIdSchema.meta({ example: '6ad24e609609bf3649c97cdf' }),
    code: z.string().meta({ example: 'T-24013' }),
    status: z.enum(TripStatus),
    startedAt: z.iso.datetime().meta({ example: '2026-10-16T12:00:00.000Z' }),
    endedAt: z.iso.datetime().nullable().meta({ description: 'null until the trip is processed', example: '2026-10-16T12:05:00.000Z' }),
    durationSeconds: z.number().nullable().meta({ example: 300 }),
    distanceKm: z.number().nullable().meta({ example: 2.4 }),
    speedLimitKmh: z.number().nullable().meta({ description: 'Set when the trip was planned', example: 35 }),
  }),
  route: tripRouteSchema,
  incidents: z.array(incidentMarkerSchema).meta({ description: 'Chronological, including those without a location' }),
  timeline: z.object({
    drivingActions: z.array(timelineEventSchema),
    driverStates: z.array(timelineEventSchema).meta({
      description: 'Driver-monitoring incidents (distraction, phone usage, drowsiness, eye closure); continuous state intervals are not recorded',
    }),
  }),
  metadata: z.object({
    hasRoute: z.boolean().meta({ description: 'false when no GPS points were recorded for the trip' }),
    hasIncidents: z.boolean(),
    incidentsWithoutLocation: z.number().int().meta({ description: 'Incidents left off the map for lack of a GPS fix', example: 0 }),
    speedUnit: z.literal('km/h'),
    coordinateSystem: z.literal('WGS84'),
    nearLimitTolerancePercent: z.number().meta({ description: '"Near limit" is up to this far above the limit', example: 10 }),
  }),
});
export type TripMapDto = z.infer<typeof tripMapSchema>;
