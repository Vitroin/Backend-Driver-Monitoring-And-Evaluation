import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IncidentCategory,
  IncidentSeverity,
  IncidentType,
  SpeedCategory,
  SpeedLimitSource,
  TripStatus,
  UserRole,
} from '@common/enums';
import type { IncidentsService } from '@modules/incidents/incidents.service';
import { TripMapService } from './trip-map.service';
import type { TripRouteRepository } from './trip-route.repository';
import type { TripsRepository } from './trips.repository';

async function* stream<T>(items: T[]) {
  yield* items;
}

const startedAt = new Date('2026-10-16T12:00:00.000Z');
const at = (seconds: number) => new Date(startedAt.getTime() + seconds * 1000);
const point = (seconds: number, speedKmh: number | null, speedLimitKmh: number | null = null) => ({
  recordedAt: at(seconds),
  latitude: 31.2 + seconds / 10_000,
  longitude: 29.9 + seconds / 10_000,
  speedKmh,
  speedLimitKmh,
  headingDeg: 90,
});

describe('TripMapService', () => {
  const driverId = new Types.ObjectId();
  const organizationId = new Types.ObjectId();
  const tripId = new Types.ObjectId();
  const driver = { _id: driverId, role: UserRole.DRIVER, organization: [organizationId] };

  const trip = {
    _id: tripId,
    code: 'T-24013',
    status: TripStatus.COMPLETED,
    startedAt,
    durationSeconds: 300,
    distanceKm: 2.4,
    speedLimitKmh: 35,
    driver: driverId,
    organization: organizationId,
  };

  const tripsRepository = { findMapTrip: vi.fn() };
  const tripRouteRepository = { countPoints: vi.fn(), streamPoints: vi.fn() };
  const incidentsService = { findByTrip: vi.fn() };
  const service = new TripMapService(
    tripsRepository as unknown as TripsRepository,
    tripRouteRepository as unknown as TripRouteRepository,
    incidentsService as unknown as IncidentsService,
  );

  const withRoute = (points: ReturnType<typeof point>[]) => {
    tripRouteRepository.countPoints.mockResolvedValue(points.length);
    tripRouteRepository.streamPoints.mockImplementation(() => stream(points));
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tripsRepository.findMapTrip.mockResolvedValue(trip);
    withRoute([]);
    incidentsService.findByTrip.mockResolvedValue([]);
  });

  describe('access', () => {
    it('404s for a missing trip', async () => {
      tripsRepository.findMapTrip.mockResolvedValue(null);
      await expect(service.getMap(driver, tripId, { maxPoints: 100 })).rejects.toThrow(NotFoundException);
    });

    it("404s for another driver's trip without reading its route or incidents", async () => {
      const otherDriver = { ...driver, _id: new Types.ObjectId() };
      await expect(service.getRoute(otherDriver, tripId, { maxPoints: 100 })).rejects.toThrow(NotFoundException);
      await expect(service.getIncidents(otherDriver, tripId, {})).rejects.toThrow(NotFoundException);
      expect(tripRouteRepository.streamPoints).not.toHaveBeenCalled();
      expect(incidentsService.findByTrip).not.toHaveBeenCalled();
    });
  });

  describe('getRoute', () => {
    it('classifies each point against the limit that applies there', async () => {
      const second = point(2, 36);
      withRoute([point(0, 30), second, point(4, 39), point(6, 45, 50), point(8, null)]);

      const { data } = await service.getRoute(driver, tripId, { maxPoints: 100 });

      expect(data.points.map((p) => [p.speedCategory, p.speedLimitKmh, p.speedLimitSource])).toEqual([
        [SpeedCategory.WITHIN_LIMIT, 35, SpeedLimitSource.TRIP],
        [SpeedCategory.NEAR_LIMIT, 35, SpeedLimitSource.TRIP],
        [SpeedCategory.OVER_LIMIT, 35, SpeedLimitSource.TRIP],
        [SpeedCategory.WITHIN_LIMIT, 50, SpeedLimitSource.ROUTE],
        [SpeedCategory.UNKNOWN, 35, SpeedLimitSource.TRIP],
      ]);
      expect(data.points[1]).toEqual({
        latitude: second.latitude,
        longitude: second.longitude,
        recordedAt: '2026-10-16T12:00:02.000Z',
        offsetSeconds: 2,
        speedKmh: 36,
        speedLimitKmh: 35,
        speedLimitSource: SpeedLimitSource.TRIP,
        headingDeg: 90,
        speedCategory: SpeedCategory.NEAR_LIMIT,
      });
      expect(data.segments).toEqual([
        { speedCategory: SpeedCategory.WITHIN_LIMIT, startIndex: 0, endIndex: 1 },
        { speedCategory: SpeedCategory.NEAR_LIMIT, startIndex: 1, endIndex: 2 },
        { speedCategory: SpeedCategory.OVER_LIMIT, startIndex: 2, endIndex: 3 },
        { speedCategory: SpeedCategory.WITHIN_LIMIT, startIndex: 3, endIndex: 4 },
      ]);
      expect(data).toMatchObject({ totalPoints: 5, downsampled: false });
    });

    it('marks every point unknown when the trip has no speed limit', async () => {
      tripsRepository.findMapTrip.mockResolvedValue({ ...trip, speedLimitKmh: null });
      withRoute([point(0, 30), point(2, 90)]);

      const { data } = await service.getRoute(driver, tripId, { maxPoints: 100 });

      expect(data.points.map((p) => [p.speedCategory, p.speedLimitSource])).toEqual([
        [SpeedCategory.UNKNOWN, null],
        [SpeedCategory.UNKNOWN, null],
      ]);
    });

    it('returns an empty route when no GPS was recorded', async () => {
      const { data } = await service.getRoute(driver, tripId, { maxPoints: 100 });
      expect(data).toEqual({ points: [], segments: [], totalPoints: 0, downsampled: false });
    });

    it('downsamples a long route to about maxPoints', async () => {
      withRoute(Array.from({ length: 10 }, (_, i) => point(i, 30)));

      const { data } = await service.getRoute(driver, tripId, { maxPoints: 5 });

      expect(data.points.map((p) => p.offsetSeconds)).toEqual([0, 2, 4, 6, 8, 9]);
      expect(data).toMatchObject({ totalPoints: 10, downsampled: true });
    });

    it('only reads the requested time range', async () => {
      const from = at(60);
      const to = at(120);
      await service.getRoute(driver, tripId, { from, to, maxPoints: 100 });
      expect(tripRouteRepository.countPoints).toHaveBeenCalledWith(tripId, { from, to });
      expect(tripRouteRepository.streamPoints).toHaveBeenCalledWith(tripId, { from, to });
    });
  });

  describe('getIncidents', () => {
    const incidentId = new Types.ObjectId();
    const incident = {
      _id: incidentId,
      type: IncidentType.HARSH_BRAKING,
      severity: IncidentSeverity.HIGH,
      occurredAt: at(132),
      location: { latitude: 31.2005, longitude: 29.9192 },
      speedKmh: 36,
      clipUrl: 'https://res.cloudinary.com/clip.mp4',
      pointsDeducted: 5.6,
    };

    it("returns markers with the trip's limit and the time into the trip", async () => {
      incidentsService.findByTrip.mockResolvedValue([incident]);

      const { data } = await service.getIncidents(driver, tripId, { eventType: IncidentType.HARSH_BRAKING });

      expect(incidentsService.findByTrip).toHaveBeenCalledWith(tripId, { eventType: IncidentType.HARSH_BRAKING });
      expect(data).toEqual([
        {
          id: incidentId.toString(),
          type: IncidentType.HARSH_BRAKING,
          category: IncidentCategory.DRIVING_ACTION,
          severity: IncidentSeverity.HIGH,
          occurredAt: '2026-10-16T12:02:12.000Z',
          offsetSeconds: 132,
          location: { latitude: 31.2005, longitude: 29.9192 },
          speedKmh: 36,
          speedLimitKmh: 35,
          pointsDeducted: 5.6,
          clipUrl: 'https://res.cloudinary.com/clip.mp4',
        },
      ]);
    });

    it('leaves the location null rather than guessing one', async () => {
      // An incident saved before location/speedKmh existed: lean() returns the fields as undefined
      const { location: _location, speedKmh: _speedKmh, ...legacy } = incident;
      incidentsService.findByTrip.mockResolvedValue([legacy]);

      const { data } = await service.getIncidents(driver, tripId, {});

      expect(data[0]).toMatchObject({ location: null, speedKmh: null });
    });
  });

  describe('getMap', () => {
    const incident = (type: IncidentType, seconds: number, location: { latitude: number; longitude: number } | null) => ({
      _id: new Types.ObjectId(),
      type,
      severity: IncidentSeverity.MEDIUM,
      occurredAt: at(seconds),
      location,
      speedKmh: null,
      clipUrl: null,
      pointsDeducted: 3,
    });

    it('puts the summary, route, markers and both timeline rows together', async () => {
      withRoute([point(0, 30), point(2, 40)]);
      incidentsService.findByTrip.mockResolvedValue([
        incident(IncidentType.SPEEDING, 2, { latitude: 31.2002, longitude: 29.9002 }),
        incident(IncidentType.PHONE_USAGE, 90, null),
      ]);

      const { message, data } = await service.getMap(driver, tripId, { maxPoints: 100 });

      expect(message).toBe('Trip map data');
      expect(incidentsService.findByTrip).toHaveBeenCalledWith(tripId, undefined);
      expect(data.trip).toEqual({
        id: tripId.toString(),
        code: 'T-24013',
        status: TripStatus.COMPLETED,
        startedAt: '2026-10-16T12:00:00.000Z',
        endedAt: '2026-10-16T12:05:00.000Z',
        durationSeconds: 300,
        distanceKm: 2.4,
        speedLimitKmh: 35,
      });
      expect(data.route.points).toHaveLength(2);
      expect(data.incidents).toHaveLength(2);
      expect(data.timeline.drivingActions).toEqual([
        expect.objectContaining({ type: IncidentType.SPEEDING, offsetSeconds: 2, durationSeconds: null }),
      ]);
      expect(data.timeline.driverStates).toEqual([
        expect.objectContaining({ type: IncidentType.PHONE_USAGE, offsetSeconds: 90, durationSeconds: null }),
      ]);
      expect(data.metadata).toEqual({
        hasRoute: true,
        hasIncidents: true,
        incidentsWithoutLocation: 1,
        speedUnit: 'km/h',
        coordinateSystem: 'WGS84',
        nearLimitTolerancePercent: 10,
      });
    });

    it('says so when there is no route or end time yet', async () => {
      tripsRepository.findMapTrip.mockResolvedValue({ ...trip, status: TripStatus.PROCESSING, durationSeconds: null, distanceKm: null });

      const { data } = await service.getMap(driver, tripId, { maxPoints: 100 });

      expect(data.trip).toMatchObject({ endedAt: null, durationSeconds: null, distanceKm: null });
      expect(data.metadata).toMatchObject({ hasRoute: false, hasIncidents: false, incidentsWithoutLocation: 0 });
    });
  });
});
