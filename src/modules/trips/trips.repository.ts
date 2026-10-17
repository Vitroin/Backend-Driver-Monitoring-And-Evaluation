import { TripStatus } from '@common/enums';
import { BaseRepository } from '@common/repositories';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import type { ScoredTrip } from './trip-scoring';
import { Trip, TripDocument } from './trips.model';
import { TripsFilterDto } from './trips_filter.dto';
import { Incident } from '@modules/incidents/incidents.model';
import type { User } from '@modules/users/user.model';

export type TripTotals = { trips: number; distanceKm: number; durationSeconds: number };
export type ScoredTripRow = ScoredTrip & { _id: Types.ObjectId; code: string };
export type MapTripRow = Pick<
  Trip,
  'code' | 'status' | 'startedAt' | 'durationSeconds' | 'distanceKm' | 'speedLimitKmh' | 'driver' | 'organization'
> & { _id: Types.ObjectId };
// driver is null if the user document no longer exists
export type DashboardHeaderRow = Pick<Trip, 'startedAt' | 'durationSeconds' | 'vehicle'> & {
  driver: Pick<User, 'fullName'> | null;
};

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

  // Trip Report Dashboard: Returns the trip's motion signals: steeringWheelAngle, tripSpeeds, accelerations, tripSpeedLimits and tripAccelerations.
  async findSpeedMotionGraph(tripId: string | Types.ObjectId) {
    const trip = await this.tripModel
      .findById(tripId)
      .select('tripSpeeds  -_id')
      .lean<Pick<Trip, 'tripSpeeds'>>()
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
      .lean<Pick<Trip, 'tripAccelerations'>>()
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
      .lean<Pick<Trip, 'steeringWheelAngle'>>()
      .exec();
    if (!trip) throw new NotFoundException(`Trip ${tripId} not found`);

    return {
      steerings: trip.steeringWheelAngle ?? [],
    };
  }

  // Returns Trip Report Dashboard header fields: startedAt, durationSeconds, vehicle and driver.fullName.
  findDashboardHeader(tripId: string | Types.ObjectId): Promise<DashboardHeaderRow | null> {
    return this.tripModel
      .findById(tripId)
      .select('startedAt durationSeconds vehicle driver -_id')
      .populate({ path: 'driver', select: 'fullName -_id' })
      .lean<DashboardHeaderRow>()
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
    return this.tripModel.aggregate([
      { $match: { driver: new Types.ObjectId(driverId), status: TripStatus.COMPLETED, score: { $ne: null } } },
      { $sort: { date: -1 } },
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
