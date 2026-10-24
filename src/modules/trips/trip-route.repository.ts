import { BaseRepository } from '@common/repositories';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, mongo, QueryFilter, Types } from 'mongoose';
import { TripRoutePoint } from './trip-route-point.model';

// Mongoose replaces the driver's WriteErrors with `{ err, index }` objects, so the code is on `err`
type WriteErrorLike = { code?: number; err?: { code?: number } };
const DUPLICATE_KEY = 11000;

function onlyDuplicateKeyErrors(error: mongo.MongoBulkWriteError): boolean {
  const writeErrors: WriteErrorLike[] = Array.isArray(error.writeErrors) ? error.writeErrors : [error.writeErrors];
  return writeErrors.length > 0 && writeErrors.every((writeError) => (writeError.code ?? writeError.err?.code) === DUPLICATE_KEY);
}

export type RoutePointRow = Pick<
  TripRoutePoint,
  'recordedAt' | 'latitude' | 'longitude' | 'speedKmh' | 'speedLimitKmh' | 'headingDeg'
>;
export type RouteTimeRange = { from?: Date; to?: Date };

@Injectable()
export class TripRouteRepository extends BaseRepository<TripRoutePoint> {
  constructor(@InjectModel(TripRoutePoint.name) private readonly routePointModel: Model<TripRoutePoint>) {
    super(routePointModel);
  }

  countPoints(tripId: Types.ObjectId, range: RouteTimeRange): Promise<number> {
    return this.routePointModel.countDocuments(this.rangeFilter(tripId, range)).exec();
  }

  // The trip's GPS fixes in chronological order, streamed in batches so a long trip is never all in memory at once
  streamPoints(tripId: Types.ObjectId, range: RouteTimeRange = {}): AsyncIterable<RoutePointRow> {
    return this.routePointModel
      .find(this.rangeFilter(tripId, range))
      .select('recordedAt latitude longitude speedKmh speedLimitKmh headingDeg -_id')
      .sort({ recordedAt: 1 })
      .lean<RoutePointRow>()
      .cursor();
  }

  /**
   * Stores uploaded fixes, skipping any the trip already has at the same time (the { trip, recordedAt } unique index),
   * so a batch sent twice is stored once. @returns How many were new.
   */
  async insertIgnoringDuplicates(points: TripRoutePoint[]): Promise<number> {
    if (points.length === 0) return 0;
    try {
      const inserted = await this.routePointModel.insertMany(points, { ordered: false });
      return inserted.length;
    } catch (error) {
      if (error instanceof mongo.MongoBulkWriteError && onlyDuplicateKeyErrors(error)) return error.insertedCount;
      throw error;
    }
  }

  private rangeFilter(tripId: Types.ObjectId, { from, to }: RouteTimeRange): QueryFilter<TripRoutePoint> {
    const filter: QueryFilter<TripRoutePoint> = { trip: tripId };
    if (from || to) filter.recordedAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
    return filter;
  }
}
