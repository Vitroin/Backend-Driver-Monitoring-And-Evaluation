import { TripStatus } from '@common/enums';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IncidentsService } from '@modules/incidents/incidents.service';
import type { UserDocument } from '@modules/users/user.model';
import { Types } from 'mongoose';
import * as crypto from 'node:crypto';
import { TRIP_COMPLETED_EVENT, type TripCompletedEvent } from './trip-events';
import { TripRouteRepository } from './trip-route.repository';
import { scoreForDeductions } from './trip-scoring';
import { measureRoute, tripMeasurements } from './trip-stats';
import type { CompleteTripDto, IncidentsBatchDto, RoutePointsBatchDto, StartTripDto, TelemetryBatchDto } from './trip-upload.dto';
import { OPEN_TRIP_STATUSES, type TripDocument } from './trips.model';
import { TripsRepository, type MotionReadings } from './trips.repository';

/** How many items of a batch were received, and how many of them were new (the rest were already stored). */
export type UploadResult = { received: number; stored: number };

// What the upload checks need, without the trip's motion readings
const OPEN_TRIP_FIELDS = 'code driver organization status startedAt';
const MOTION_FIELDS = 'tripSpeeds tripAccelerations steeringWheelAngle';
const MOTION_TIME_FIELDS = 'tripSpeeds.time tripAccelerations.time steeringWheelAngle.time';

// The top speed reading, and when the last reading of any graph was taken
function summarizeMotion({ tripSpeeds = [], tripAccelerations = [], steeringWheelAngle = [] }: Partial<MotionReadings>) {
  const speeds = tripSpeeds.map(({ speed }) => speed);
  const times = [...tripSpeeds, ...tripAccelerations, ...steeringWheelAngle]
    .map(({ time }) => Date.parse(time))
    .filter((time) => !Number.isNaN(time));
  return {
    topSpeedKmh: speeds.length ? Math.max(...speeds) : null,
    lastRecordedAt: times.length ? new Date(Math.max(...times)) : null,
  };
}

/*
 * What the in-vehicle unit does during a drive, logged in as the driver, stored in the existing trip models:
 *   startTrip        the trip starts RECORDING
 *   addRoutePoints   GPS fixes, in batches (TripRoutePoint, which the trip map draws)
 *   addTelemetry     speed / acceleration / steering readings, in batches (the trip's motion graphs)
 *   addIncidents     detected events, in batches
 *   completeTrip     end it: measured, scored, COMPLETED, and `trip.completed` is emitted
 * No route calls it yet. Every batch can be re-sent safely; readings and incidents already stored are skipped.
 */
@Injectable()
export class TripIngestionService {
  constructor(
    private readonly tripsRepository: TripsRepository,
    private readonly routeRepository: TripRouteRepository,
    private readonly incidentsService: IncidentsService,
    private readonly events: EventEmitter2,
  ) {}

  async startTrip(driver: UserDocument, { vehicle, startedAt, speedLimitKmh }: StartTripDto): Promise<TripDocument> {
    if (!driver.organization) throw new BadRequestException('Only drivers who belong to an organization can record trips');
    return this.tripsRepository.create({
      code: await this.newTripCode(),
      driver: driver._id,
      organization: driver.organization,
      vehicle,
      status: TripStatus.RECORDING,
      startedAt: startedAt ?? new Date(),
      speedLimitKmh: speedLimitKmh ?? null,
    });
  }

  async addRoutePoints(driver: UserDocument, tripId: Types.ObjectId, { points }: RoutePointsBatchDto): Promise<UploadResult> {
    const trip = await this.findOpenTripOf(driver, tripId);
    const stored = await this.routeRepository.insertIgnoringDuplicates(points.map((point) => ({ ...point, trip: trip._id })));
    return { received: points.length, stored };
  }

  async addTelemetry(driver: UserDocument, tripId: Types.ObjectId, { points }: TelemetryBatchDto): Promise<UploadResult> {
    const trip = await this.findOpenTripOf(driver, tripId);

    // A reading at a time the trip already has a reading for was sent before
    const known = await this.tripsRepository.findById(trip._id.toString(), MOTION_TIME_FIELDS);
    const seen = new Set(
      [...(known?.tripSpeeds ?? []), ...(known?.tripAccelerations ?? []), ...(known?.steeringWheelAngle ?? [])].map(({ time }) => time),
    );

    const readings: MotionReadings = { tripSpeeds: [], tripAccelerations: [], steeringWheelAngle: [] };
    let stored = 0;
    for (const { time, speed, acceleration, steeringWheelAngle } of points) {
      if (seen.has(time)) continue;
      seen.add(time);
      stored++;
      if (speed !== undefined) readings.tripSpeeds.push({ time, speed });
      if (acceleration !== undefined) readings.tripAccelerations.push({ time, acceleration });
      if (steeringWheelAngle !== undefined) readings.steeringWheelAngle.push({ time, steeringWheelAngle });
    }
    if (stored > 0) await this.tripsRepository.addMotionReadings(trip._id, readings);
    return { received: points.length, stored };
  }

  async addIncidents(driver: UserDocument, tripId: Types.ObjectId, { incidents }: IncidentsBatchDto): Promise<UploadResult> {
    const trip = await this.findOpenTripOf(driver, tripId);
    // the driver is copied from the trip, never taken from the request
    const stored = await this.incidentsService.recordIncidents(
      incidents.map((incident) => ({ ...incident, trip: trip._id, driver: trip.driver })),
    );
    return { received: incidents.length, stored };
  }

  /** Measures and scores the trip from what was uploaded, marks it COMPLETED and emits `trip.completed`. */
  async completeTrip(driver: UserDocument, tripId: Types.ObjectId, { endedAt }: CompleteTripDto): Promise<TripDocument> {
    const trip = await this.findOpenTripOf(driver, tripId);
    const [route, readings, incidents] = await Promise.all([
      measureRoute(this.routeRepository.streamPoints(trip._id)),
      this.tripsRepository.findById(trip._id.toString(), MOTION_FIELDS),
      this.incidentsService.tripTotals(trip._id),
    ]);
    const motion = summarizeMotion(readings ?? {});

    const lastReadingAt = [route.lastRecordedAt, motion.lastRecordedAt].filter((date): date is Date => date !== null);
    const end = endedAt ?? (lastReadingAt.length ? new Date(Math.max(...lastReadingAt.map((date) => date.getTime()))) : new Date());
    if (end < trip.startedAt) throw new BadRequestException('`endedAt` must be after the trip started');

    const score = scoreForDeductions(incidents.pointsDeducted);
    const completed = await this.tripsRepository.updateOpenTrip(trip._id, {
      ...tripMeasurements(trip.startedAt, end, route, motion.topSpeedKmh),
      eventsCount: incidents.count,
      score,
      status: TripStatus.COMPLETED,
    });
    // Another request completed it between the read above and this update
    if (!completed) throw new ConflictException('Trip is already completed');

    const event: TripCompletedEvent = { tripId: trip._id.toString(), driverId: driver.id, driverName: driver.fullName, code: trip.code, score };
    this.events.emit(TRIP_COMPLETED_EVENT, event);
    return completed;
  }

  /**
   * The driver's own trip, while it can still take uploads.
   * @throws NotFoundException for another driver's trip (the same as a missing one); ConflictException once it's completed.
   */
  private async findOpenTripOf(driver: UserDocument, tripId: Types.ObjectId): Promise<TripDocument> {
    const trip = await this.tripsRepository.findById(tripId.toString(), OPEN_TRIP_FIELDS);
    if (!trip || !trip.driver.equals(driver._id)) throw new NotFoundException('Trip not found');
    if (!OPEN_TRIP_STATUSES.includes(trip.status)) throw new ConflictException(`Trip is ${trip.status}; it can't take uploads any more`);
    return trip;
  }

  // T- and 6 random digits (seeded trips use 5). The random part makes a clash unlikely; if one happens, draw again
  private async newTripCode(): Promise<string> {
    let code: string;
    do {
      code = `T-${crypto.randomInt(100_000, 1_000_000)}`;
    } while (await this.tripsRepository.exists({ code }));
    return code;
  }
}
