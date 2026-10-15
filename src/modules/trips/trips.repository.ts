import { TripStatus } from '@common/enums';
import { BaseRepository } from '@common/repositories';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { ScoredTrip } from './trip-scoring';
import { Trip, TripDocument } from './trips.model';

export type ScoredTripRow = ScoredTrip & { _id: Types.ObjectId; code: string };

@Injectable()
export class TripsRepository extends BaseRepository<Trip> {
  constructor(@InjectModel(Trip.name) private readonly tripModel: Model<Trip>) {
    super(tripModel);
  }

  // Totals over the driver's completed trips; zeros when they have none
  async getTotals(
    driverId: string | Types.ObjectId,
  ): Promise<{ trips: number; distanceKm: number; durationSeconds: number }> {
    const [result] = await this.tripModel.aggregate<{ trips: number; distanceKm: number; durationSeconds: number }>([
      // aggregate() doesn't turn string ids into ObjectIds like find() does, so convert it here
      { $match: { driver: new Types.ObjectId(driverId), status: TripStatus.COMPLETED } },
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
    return result ?? { trips: 0, distanceKm: 0, durationSeconds: 0 };
  }

  // The driver's scored, completed trips, newest first.
  // `before` keeps only trips that started earlier; `limit` keeps only the newest ones.
  findScoredTrips(driverId: string | Types.ObjectId, { before, limit = 0 }: { before?: Date; limit?: number } = {}) {
    return this.tripModel
      .find({
        driver: driverId,
        status: TripStatus.COMPLETED,
        score: { $ne: null },
        ...(before && { startedAt: { $lt: before } }),
      })
      .sort({ startedAt: -1 })
      .limit(limit) // 0 means no limit
      .lean<ScoredTripRow[]>()
      .exec();
  }

  // The driver's latest trips of any status (planned ones too), newest first.
  // Not lean(): the trip's `risk` is a virtual, and lean() results don't have virtuals.
  findRecent(driverId: string | Types.ObjectId, limit: number): Promise<TripDocument[]> {
    return this.tripModel.find({ driver: driverId }).sort({ startedAt: -1 }).limit(limit).exec();
  }
}
