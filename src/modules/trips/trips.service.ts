import type { DataResponseDto } from '@common';
import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import type { LastTripScoreDto, RecentTripDto, TripTotalsDto } from './response';
import { average, longTermScore, riskForScore, roundToOneDecimal } from './trip-scoring';
import { TripDocument } from './trips.model';
import { TripsRepository } from './trips.repository';
import { ScoreOverviewDto } from './response/score-overview.response';

// "Last trip score" compares the last trip with the average of the 5 before it
const RECENT_TRIPS = 5;
// How many trips the dashboard's "Recent trips" card shows
const RECENT_TRIPS_LIST_SIZE = 6;

@Injectable()
export class TripsService {
  constructor(private readonly tripsRepository: TripsRepository) {}

  async getLastTripScore(driverId: string): Promise<DataResponseDto<LastTripScoreDto | null>> {
    const [last, ...previous] = await this.tripsRepository.findScoredTrips(driverId, { limit: RECENT_TRIPS + 1 });
    if (!last) return { message: 'No completed trips yet', data: null };

    const previousAverage = previous.length > 0 ? average(previous.map((trip) => trip.score)) : null;
    return {
      message: 'Last trip score',
      data: {
        score: last.score,
        previousAverage: previousAverage === null ? null : roundToOneDecimal(previousAverage),
        change: previousAverage === null ? null : roundToOneDecimal(last.score - previousAverage),
      },
    };
  }

  async getTotals(driverId: string): Promise<DataResponseDto<TripTotalsDto>> {
    const totals = await this.tripsRepository.getTotals(driverId);
    // Adding up decimals can give 104.89999999999999, so round the distance
    return { message: 'Trip totals', data: { ...totals, distanceKm: roundToOneDecimal(totals.distanceKm) } };
  }

  async getRecentTrips(driverId: string): Promise<DataResponseDto<RecentTripDto[]>> {
    const trips = await this.tripsRepository.findRecent(driverId, RECENT_TRIPS_LIST_SIZE);
    return {
      message: 'Recent trips',
      data: trips.map(({ code, vehicle, status, startedAt, distanceKm, score, risk }) => ({
        code,
        vehicle,
        status,
        startedAt: startedAt.toISOString(),
        distanceKm,
        score,
        risk,
      })),
    };
  }

  // Long-term score ring + "Score over time" chart
  async getScoreOverview(driverId: string): Promise<DataResponseDto<ScoreOverviewDto>> {
    const trips = (await this.tripsRepository.findScoredTrips(driverId)).reverse(); // oldest first, like the chart
    const longTerm = longTermScore(trips);
    return {
      message: 'Score overview',
      data: {
        longTermScore: longTerm,
        riskLevel: longTerm === null ? null : riskForScore(longTerm),
        // One point per completed trip; the chart shows the last 14
        history: trips.map((trip) => ({
          tripId: trip._id.toString(),
          code: trip.code,
          score: trip.score,
          startedAt: trip.startedAt.toISOString(),
        })),
      },
    };
  }

  // ---------- used by other modules ----------

  findByCode(code: string): Promise<TripDocument | null> {
    return this.tripsRepository.findOne({ code });
  }

  findById(id: string): Promise<TripDocument | null> {
    return this.tripsRepository.findById(id);
  }

  // The report's trend and recommendations: the driver's scored trips before `before`, newest first
  findPreviousScoredTrips(driverId: Types.ObjectId, before: Date, limit: number) {
    return this.tripsRepository.findScoredTrips(driverId, { before, limit });
  }

  // Every trip of the driver, newest first ("Download my data")
  findAllByDriver(driverId: Types.ObjectId): Promise<TripDocument[]> {
    return this.tripsRepository.find({ driver: driverId }, undefined, { sort: { startedAt: -1 } });
  }
}
