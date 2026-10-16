import { TripStatus } from '@common/enums';
import { BaseRepository } from '@common/repositories';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import type { ScoredTrip } from './trip-scoring';
import { Trip, TripDocument } from './trips.model';
import { TripsFilterDto } from './trips_filter.dto';
import { Incident } from '@modules/incidents/incidents.model';

export type TripTotals = { trips: number; distanceKm: number; durationSeconds: number };
export type ScoredTripRow = ScoredTrip & { _id: Types.ObjectId; code: string };
export type MapTripRow = Pick<
  Trip,
  'code' | 'status' | 'startedAt' | 'durationSeconds' | 'distanceKm' | 'speedLimitKmh' | 'driver' | 'organization'
> & { _id: Types.ObjectId };

const EMPTY_TOTALS: TripTotals = { trips: 0, distanceKm: 0, durationSeconds: 0 };

@Injectable()
export class TripsRepository extends BaseRepository<Trip> {
  constructor(@InjectModel(Trip.name) private readonly tripModel: Model<Trip>) {
    super(tripModel);
  }

  // Totals over the driver's completed trips; zeros when they have none
  async getTotals(driverId: string | Types.ObjectId): Promise<TripTotals> {
    const [totals] = await this.tripModel.aggregate<TripTotals>([
      { $match: { driverId, status: TripStatus.COMPLETED } },
      {
        $group: {
          _id: null,
          trips: { $sum: 1 },
          distanceKm: { $sum: '$distanceKm' },
          durationSeconds: { $sum: '$durationSeconds' },
        },
      },
      { $project: { _id: 0 } },
    ]);
    return totals ?? { ...EMPTY_TOTALS };
  }

  // Scored, completed trips, newest first.
  // `before` keeps trips that started earlier; `limit` 0 means no limit.
  findScoredTrips(driverId: string | Types.ObjectId, { before, limit = 0 }: { before?: Date; limit?: number } = {}) {
    const filter: QueryFilter<Trip> = {
      driver: driverId,
      status: TripStatus.COMPLETED,
      score: { $ne: null },
    };
    if (before) filter.startedAt = { $lt: before };

    return this.tripModel.find(filter).sort({ startedAt: -1 }).limit(limit).lean<ScoredTripRow[]>().exec();
  }

  // Latest trips of any status, newest first.
  // Not lean(): `risk` is a virtual, and lean() drops virtuals.
  findRecent(driverId: string | Types.ObjectId, limit: number): Promise<TripDocument[]> {
    return this.tripModel.find({ driver: driverId }).sort({ startedAt: -1 }).limit(limit).exec();
  }

  // The driver's trips matching the filter, newest first, each with its incidents in chronological order.
  // With eventType, only incidents of that type are attached and trips without any are left out.
  filterTrips(driverId: string | Types.ObjectId, { status, eventType, from, to, page, limit }: TripsFilterDto) {
    // aggregate() doesn't cast like find(), so the id must already be an ObjectId
    const match: QueryFilter<Trip> = { driver: new Types.ObjectId(driverId) };
    if (status) match.status = status;
    if (from || to) match.startedAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };

    return this.tripModel.aggregate<Trip & { _id: Types.ObjectId; incidents: Incident[] }>([
      { $match: match },
      {
        $lookup: {
          from: 'incidents',
          localField: '_id',
          foreignField: 'trip',
          pipeline: [...(eventType ? [{ $match: { type: eventType } }] : []), { $sort: { occurredAt: 1 } }],
          as: 'incidents',
        },
      },
      ...(eventType ? [{ $match: { 'incidents.0': { $exists: true } } }] : []),
      { $sort: { startedAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ]);
  }


  // Returns the incidents of a trip, each with its type, severity, occurredAt and pointsDeducted fields. The trip's own fields aren't returned.
  async findDetectedEvents(tripId: string | Types.ObjectId) {
    const trip = await this.tripModel
      .findById(tripId)
      .select('_id') // the trip's own fields aren't needed, only its incidents
      .populate({
        path: 'incidents',
        select: 'type severity occurredAt pointsDeducted trip -_id',
      })
      .lean<{ incidents: Pick<Incident, 'type' | 'severity' | 'occurredAt' | 'pointsDeducted'>[] }>()
      .exec();

    return (
      trip?.incidents.map(({ type, severity, occurredAt, pointsDeducted }) => ({
        type,
        severity,
        occurredAt,
        pointsDeducted,
      })) ?? []
    );
  }

  // The trip map's summary fields, plus driver and organization for the access check.
  // lean() also skips the incidents autopopulate; the map loads them with its own filtered query.
  findMapTrip(tripId: string | Types.ObjectId): Promise<MapTripRow | null> {
    return this.tripModel
      .findById(tripId)
      .select('code status startedAt durationSeconds distanceKm speedLimitKmh driver organization')
      .lean<MapTripRow>()
      .exec();
  }

  // Returns the trip's motion signals: steeringWheelAngle, tripSpeeds, accelerations, tripSpeedLimits and tripAccelerations.
  async findSpeedMotionGraph(tripId: string | Types.ObjectId) {
    const trip = await this.tripModel
      .findById(tripId)
      .select('tripSpeeds  -_id')
      .lean<Pick<Trip,  'tripSpeeds'>>()
      .exec();
    if (!trip) throw new NotFoundException(`Trip ${tripId} not found`);

    return {
      speeds: trip.tripSpeeds ?? [],
    };
  }

  async findAccelerationMotionGraph(tripId: string | Types.ObjectId) {
    const trip = await this.tripModel
      .findById(tripId)
      .select('tripAccelerations  -_id')
      .lean<Pick<Trip,  'tripAccelerations'>>()
      .exec();
    if (!trip) throw new NotFoundException(`Trip ${tripId} not found`);

    return {
      accelerations: trip.tripAccelerations ?? [],
    };
  }

  async findSteeringMotionGraph(tripId: string | Types.ObjectId) {
    const trip = await this.tripModel
      .findById(tripId)
      .select('steeringWheelAngle  -_id')
      .lean<Pick<Trip,  'steeringWheelAngle'>>()
      .exec();
    if (!trip) throw new NotFoundException(`Trip ${tripId} not found`);

    return {
      steerings: trip.steeringWheelAngle ?? [],
    };
  }

  // Helper Functions to find incidents for a trip, with optional filtering by event type---------------------------
  async findIncidentsForTrip(tripId: string | Types.ObjectId) {
    const trip = await this.tripModel
      .findById(tripId)
      .populate('incidents')
      .lean<Trip & { incidents: Incident[] }>()
      .exec();
    return trip?.incidents ?? [];
  }

  async findFilteredIncidentsForTrip(tripId: string | Types.ObjectId, dto: TripsFilterDto) {
    const incidents = await this.findIncidentsForTrip(tripId);
    return incidents.filter((incident) => {
      if (dto.eventType && incident.type !== dto.eventType) return false;
      return true;
    });
  }
}
