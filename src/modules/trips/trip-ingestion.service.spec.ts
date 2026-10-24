import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TripStatus, UserRole } from '@common/enums';
import type { IncidentsService } from '@modules/incidents/incidents.service';
import type { UserDocument } from '@modules/users/user.model';
import { TRIP_COMPLETED_EVENT } from './trip-events';
import { TripIngestionService } from './trip-ingestion.service';
import type { TripRouteRepository } from './trip-route.repository';
import type { TripTelemetryRepository } from './trip-telemetry.repository';
import type { TripsRepository } from './trips.repository';
import type { TripsService } from './trips.service';

async function* stream<T>(items: T[]) {
  yield* items;
}

describe('TripIngestionService', () => {
  const tripsRepository = { create: vi.fn(), nextCode: vi.fn(), findById: vi.fn(), updateOpenTrip: vi.fn() };
  const tripsService = { detailsOf: vi.fn() };
  const routeRepository = { insertIgnoringDuplicates: vi.fn(), streamPoints: vi.fn() };
  const telemetryRepository = { insertIgnoringDuplicates: vi.fn(), summary: vi.fn() };
  const incidentsService = { recordIncidents: vi.fn(), tripTotals: vi.fn() };
  const events = { emit: vi.fn() };
  const service = new TripIngestionService(
    tripsRepository as unknown as TripsRepository,
    tripsService as unknown as TripsService,
    routeRepository as unknown as TripRouteRepository,
    telemetryRepository as unknown as TripTelemetryRepository,
    incidentsService as unknown as IncidentsService,
    events as unknown as EventEmitter2,
  );

  const organization = new Types.ObjectId();
  const driver = { _id: new Types.ObjectId(), id: '', fullName: 'Youssef Nabil', role: UserRole.DRIVER, organization } as unknown as UserDocument;
  driver.id = driver._id.toString();
  const tripId = new Types.ObjectId();
  const startedAt = new Date('2026-10-16T12:00:00Z');
  const openTrip = { _id: tripId, code: 'T-10001', driver: driver._id, organization, status: TripStatus.RECORDING, startedAt };

  beforeEach(() => {
    vi.clearAllMocks();
    tripsRepository.findById.mockResolvedValue(openTrip);
    tripsService.detailsOf.mockResolvedValue({ id: tripId.toString() });
  });

  it("starts a trip in the driver's organization with the next code", async () => {
    tripsRepository.nextCode.mockResolvedValue('T-10001');
    tripsRepository.create.mockResolvedValue({ _id: tripId });

    await service.startTrip(driver, { vehicle: 'Kart GK-01' });

    expect(tripsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'T-10001', driver: driver._id, organization, status: TripStatus.RECORDING, speedLimitKmh: null }),
    );
  });

  it("won't start a trip for a driver without an organization", async () => {
    await expect(service.startTrip({ ...driver, organization: null } as unknown as UserDocument, { vehicle: 'x' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('copies the driver and organization onto uploaded incidents from the trip, and counts the new ones', async () => {
    incidentsService.recordIncidents.mockResolvedValue(1);
    const incident = { type: 'speeding', severity: 'low', occurredAt: new Date(), location: null, speedKmh: null, clipUrl: null, clipPublicId: null, pointsDeducted: 2 };

    await expect(service.addIncidents(driver, tripId, { incidents: [incident, incident] } as never)).resolves.toEqual({ received: 2, stored: 1 });
    expect(incidentsService.recordIncidents.mock.calls[0][0][0]).toMatchObject({ trip: tripId, driver: driver._id, organization });
  });

  it("404s for another driver's trip and 409s for a completed one", async () => {
    tripsRepository.findById.mockResolvedValueOnce({ ...openTrip, driver: new Types.ObjectId() });
    await expect(service.addTelemetry(driver, tripId, { points: [] })).rejects.toBeInstanceOf(NotFoundException);

    tripsRepository.findById.mockResolvedValueOnce({ ...openTrip, status: TripStatus.COMPLETED });
    await expect(service.addRoutePoints(driver, tripId, { points: [] })).rejects.toBeInstanceOf(ConflictException);
  });

  describe('completeTrip', () => {
    beforeEach(() => {
      routeRepository.streamPoints.mockImplementation(() =>
        stream([
          { latitude: 30, longitude: 31, speedKmh: 30, recordedAt: new Date('2026-10-16T12:00:00Z') },
          { latitude: 30.1, longitude: 31, speedKmh: 60, recordedAt: new Date('2026-10-16T12:20:00Z') },
        ]),
      );
      telemetryRepository.summary.mockResolvedValue({ topSpeedKmh: 64, lastRecordedAt: new Date('2026-10-16T12:30:00Z') });
      incidentsService.tripTotals.mockResolvedValue({ count: 3, pointsDeducted: 12.5 });
      tripsRepository.updateOpenTrip.mockResolvedValue({});
    });

    it('measures and scores the trip, ends it at the last reading, and emits trip.completed', async () => {
      await service.completeTrip(driver, tripId, {});

      const [, update] = tripsRepository.updateOpenTrip.mock.calls[0];
      expect(update).toMatchObject({ status: TripStatus.COMPLETED, durationSeconds: 1800, topSpeedKmh: 64, eventsCount: 3, score: 87.5 });
      expect(update.distanceKm).toBeCloseTo(11.12, 1);
      expect(events.emit).toHaveBeenCalledWith(TRIP_COMPLETED_EVENT, {
        tripId: tripId.toString(),
        driverId: driver.id,
        driverName: 'Youssef Nabil',
        code: 'T-10001',
        score: 87.5,
      });
    });

    it('uses the endedAt it is given', async () => {
      await service.completeTrip(driver, tripId, { endedAt: new Date('2026-10-16T12:40:00Z') });
      expect(tripsRepository.updateOpenTrip.mock.calls[0][1]).toMatchObject({ durationSeconds: 2400 });
    });

    it('rejects an endedAt before the start', async () => {
      await expect(service.completeTrip(driver, tripId, { endedAt: new Date('2026-10-16T11:00:00Z') })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('409s, and emits nothing, when another request completed it first', async () => {
      tripsRepository.updateOpenTrip.mockResolvedValue(null);
      await expect(service.completeTrip(driver, tripId, {})).rejects.toBeInstanceOf(ConflictException);
      expect(events.emit).not.toHaveBeenCalled();
    });
  });
});
