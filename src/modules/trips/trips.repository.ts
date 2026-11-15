import { TripStatus } from '@common/enums';
import { BaseRepository } from '@common/repositories';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { Trip, TripDocument } from './trips.model';
import { TripsFilterDto } from './dtos/trips-filter.dto';
import { Incident } from '@modules/incidents/incidents.model';
import type { User } from '@modules/users/user.model';

export type TripTotals = { trips: number; distanceKm: number; durationSeconds: number };
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

  // Main dashboard: Totals over the driver's completed trips; zeros when they have none
  async getTotals(driverId: string | Types.ObjectId): Promise<TripTotals> {
    const [totals] = await this.tripModel.aggregate<TripTotals>([
      // aggregate() doesn't cast like find(), so the id must already be an ObjectId
      { $match: { driver: new Types.ObjectId(driverId), status: TripStatus.COMPLETED, score: { $ne: null } } },
      {
        $group: {
          _id: null,
          trips: { $sum: 1 },
          distanceKm: { $sum: '$distanceKm' },
          durationSeconds: { $sum: '$durationSeconds' },
        },
      },
      { $project: { _id: 0, trips: 1, distanceKm: { $round: ['$distanceKm', 2] }, durationSeconds: 1 } },
    ]);
    return totals ?? { ...EMPTY_TOTALS };
  }

  // Not lean(): `risk` is a virtual, and lean() drops virtuals.
  findRecentTrip(driverId: string | Types.ObjectId, limit: number): Promise<TripDocument[]> {
    return this.tripModel
      .find({ driver: driverId, status: TripStatus.COMPLETED, score: { $ne: null } })
      .sort({ startedAt: -1 })
      .limit(limit)
      .exec();
  }

  // The driver's trips matching the filter, newest first, each with its incidents in chronological order,
  // plus how many trips match in total (for pagination).
  // With eventType, only incidents of that type are attached and trips without any are left out.
  async filterTrips(driverId: string | Types.ObjectId, { status, eventType, from, to, page, limit }: TripsFilterDto) {
    // aggregate() doesn't cast like find(), so the id must already be an ObjectId
    const match: QueryFilter<Trip> = { driver: new Types.ObjectId(driverId) };
    if (status) match.status = status;
    if (from || to) match.startedAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };

    const [result] = await this.tripModel.aggregate<{
      trips: (Trip & { _id: Types.ObjectId; incidents: Incident[] })[];
      total: { count: number }[];
    }>([
      { $match: match },
      // The motion signals are only needed by the telemetry endpoint
      { $project: { tripSpeeds: 0, tripAccelerations: 0, steeringWheelAngle: 0 } },
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
      // _id as tie-breaker so pages don't overlap when two trips start at the same time
      { $sort: { startedAt: -1, _id: -1 } },
      {
        $facet: {
          trips: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
    ]);

    return { trips: result.trips, total: result.total[0]?.count ?? 0 };
  }

  //---------------------------------------------------------------
  //---------- used by the Trip Map  ----------------

  // The trip map's summary fields, plus driver and organization for the access check.
  // lean() also skips the incidents autopopulate; the map loads them with its own filtered query.
  findMapTrip(tripId: string | Types.ObjectId): Promise<MapTripRow | null> {
    return this.tripModel
      .findById(tripId)
      .select('code status startedAt durationSeconds distanceKm speedLimitKmh driver organization')
      .lean<MapTripRow>()
      .exec();
  }

  //---------------------------------------------------------------
  //---------- used by the Trip Report Dashboard's ----------------

  // Trip Report Dashboard: Returns the trip's motion signals: steeringWheelAngle, tripSpeeds and tripAccelerations.
  async findTelemetry(tripId: string | Types.ObjectId) {
    const trip = await this.tripModel
      .findById(tripId)
      .select('tripSpeeds tripAccelerations steeringWheelAngle -_id')
      .lean<Pick<Trip, 'tripSpeeds' | 'tripAccelerations' | 'steeringWheelAngle'>>()
      .exec();
    if (!trip) throw new NotFoundException(`Trip ${tripId} not found`);

    return {
      speeds: trip.tripSpeeds ?? [],
      accelerations: trip.tripAccelerations ?? [],
      steerings: trip.steeringWheelAngle ?? [],
    };
  }

  // A single trip's stats plus its driver's name.
  // lean() drops the `risk` virtual, so the service derives it from score.
  findByIdWithDriver(tripId: string | Types.ObjectId) {
    return this.tripModel
      .findById(tripId)
      .select('startedAt durationSeconds vehicle distanceKm averageSpeedKmh topSpeedKmh eventsCount score driver -_id')
      .populate<{ driver: Pick<User, 'fullName'> | null }>({ path: 'driver', select: 'fullName -_id' })
      .lean()
      .exec();
  }

  //---------------------------------------------------------------
  //---------- used by the My Progress Dashboard's ----------------

  async averageRecentTripScore(driverId: string | Types.ObjectId, lastN: number) {
    return await this.tripModel
      .aggregate<{ _id: null; averageScore: number }>([
        {
          $match: {
            driver: new Types.ObjectId(driverId),
            status: TripStatus.COMPLETED,
            score: { $ne: null },
          },
        },
        { $sort: { startedAt: -1 } }, // newest first
        { $limit: lastN }, // keep only the newest N trips
        {
          $group: {
            _id: null,
            averageScore: { $avg: '$score' },
          },
        },
      ])
      .exec();
  }

  async averageLastTripScore(driverId: string | Types.ObjectId, lastN: number) {
    return await this.tripModel
      .aggregate<{ _id: null; averageScore: number }>([
        {
          $match: {
            driver: new Types.ObjectId(driverId),
            status: TripStatus.COMPLETED,
            score: { $ne: null },
          },
        },
        { $sort: { startedAt: 1 } }, // oldest first
        { $limit: lastN }, // keep only the oldest N trips
        {
          $group: {
            _id: null,
            averageScore: { $avg: '$score' },
          },
        },
      ])
      .exec();
  }

  async averageLongTermScore(driverId: string | Types.ObjectId) {
    return await this.tripModel
      .aggregate<{ _id: null; averageScore: number }>([
        {
          $match: {
            driver: new Types.ObjectId(driverId),
            status: TripStatus.COMPLETED,
          },
        },
        {
          $group: { _id: null, averageScore: { $avg: '$score' } },
        },
      ])
      .exec();
  }

  async bestTripScore(driverId: string | Types.ObjectId) {
    return await this.tripModel
      .aggregate<{ _id: null; bestScore: number }>([
        {
          $match: {
            driver: new Types.ObjectId(driverId),
            status: TripStatus.COMPLETED,
          },
        },
        {
          $group: { _id: null, bestScore: { $max: '$score' } },
        },
      ])
      .exec();
  }

  // Used in the graph of the My Progress Dashboard AND graph of the main Dashboard
  async progressGraph(driverId: string | Types.ObjectId) {
    return this.tripModel.aggregate<{ trips: { date: Date; score: number }[] }>([
      { $match: { driver: new Types.ObjectId(driverId), status: TripStatus.COMPLETED, score: { $ne: null } } },
      { $sort: { startedAt: 1 } }, // oldest first, so the graph reads left to right
      {
        $group: {
          _id: null,
          trips: {
            $push: {
              date: '$startedAt',
              score: '$score',
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          trips: 1,
        },
      },
    ]);
  }
}
