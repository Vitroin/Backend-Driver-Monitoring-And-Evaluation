import { BaseRepository } from '@common/repositories';
import { Injectable } from '@nestjs/common';
import { Trip, TripDocument } from './trips.model';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TripStatus } from '@common/enums';

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

  // Scores of the driver's latest completed trips, newest first
  async getRecentScores(driverId: string | Types.ObjectId, limit: number): Promise<number[]> {
    const trips = await this.tripModel
      .find({ driver: new Types.ObjectId(driverId), status: TripStatus.COMPLETED, score: { $ne: null } }, { score: 1 })
      .sort({ startedAt: -1 })
      .limit(limit)
      .lean()
      .exec();
    return trips.map((trip) => trip.score as number);
  }

  async findRecent(driverId: string | Types.ObjectId, limit: number): Promise<TripDocument[]> {
    return this.tripModel
      .find({ driver: new Types.ObjectId(driverId) })
      .sort({ startedAt: -1 })
      .limit(limit)
      .exec();
  }
}
