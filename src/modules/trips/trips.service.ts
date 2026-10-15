import { Injectable } from '@nestjs/common';
import type { DataResponseDto } from '@modules/auth/response';
import { TripsRepository } from './trips.repository';
import { LastTripScoreDto } from './response/last-trip-score.response';
import { TripTotalsDto } from './response';

// How many trips before the last one make up the "recent average"
const RECENT_TRIPS = 5;

const roundToOneDecimal = (value: number): number => Math.round(value * 10) / 10;

@Injectable()
export class TripsService {
  constructor(private readonly tripsRepository: TripsRepository) {}

  async getLastTripScore(driverId: string): Promise<DataResponseDto<LastTripScoreDto | null>> {
    // Newest first: the last trip, then up to 5 trips before it
    const scores = await this.tripsRepository.getRecentScores(driverId, RECENT_TRIPS + 1);
    if (scores.length === 0) {
      return { message: 'No completed trips yet', data: null };
    }

    const [score, ...previousScores] = scores;
    if (previousScores.length === 0) {
      return { message: 'Last trip score', data: { score, previousAverage: null, change: null } };
    }

    const previousAverage = previousScores.reduce((sum, s) => sum + s, 0) / previousScores.length;
    return {
      message: 'Last trip score',
      data: {
        score,
        previousAverage: roundToOneDecimal(previousAverage),
        change: roundToOneDecimal(score - previousAverage),
      },
    };
  }

  async getTotals(driverId: string): Promise<DataResponseDto<TripTotalsDto>> {
    const totals = await this.tripsRepository.getTotals(driverId);
    return { message: 'Trip totals', data: { ...totals, distanceKm: roundToOneDecimal(totals.distanceKm) } };
  }
}
