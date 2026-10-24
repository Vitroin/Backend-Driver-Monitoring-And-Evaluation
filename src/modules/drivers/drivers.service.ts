import { Injectable } from '@nestjs/common';
import type { Types } from 'mongoose';
import { IncidentsService } from '@modules/incidents/incidents.service';
import type { TripIncidentOptions } from '@modules/incidents/incidents.repository';
import type { DriverIncidentDto } from '@modules/incidents/response/significant-event.response';
import type { IncidentTypeSummaryDto } from '@modules/incidents/response/trip-incidents.response';
import { TripsService } from '@modules/trips/trips.service';
import type { ScorePointDto } from '@modules/trips/response/score-overview.response';
import { riskForScore, roundToOneDecimal } from '@modules/trips/trip-scoring';
import type { DriverStatsDto } from './driver-stats.response';
import type { DriverIncidentsQueryDto } from './driver-incidents.dto';

// "Recent" and "first" averages are over this many scored trips
const SCORE_WINDOW = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

const INCIDENT_SORTS: Record<DriverIncidentsQueryDto['sort'], TripIncidentOptions['sort']> = {
  '-occurredAt': { occurredAt: -1 },
  '-pointsDeducted': { pointsDeducted: -1, occurredAt: -1 },
};

// A driver's numbers across all their trips
@Injectable()
export class DriversService {
  constructor(
    private readonly tripsService: TripsService,
    private readonly incidentsService: IncidentsService,
  ) {}

  async getStats(driverId: Types.ObjectId): Promise<DriverStatsDto> {
    const [totals, lastTripScore, recentAverage, firstAverage, longTermScore, bestTripScore] = await Promise.all([
      this.tripsService.completedTotals(driverId),
      this.tripsService.latestScore(driverId),
      this.tripsService.averageScore(driverId, 'newest', SCORE_WINDOW),
      this.tripsService.averageScore(driverId, 'oldest', SCORE_WINDOW),
      this.tripsService.longTermScore(driverId),
      this.tripsService.bestScore(driverId),
    ]);

    const difference = (a: number | null, b: number | null) => (a === null || b === null ? null : roundToOneDecimal(a - b));
    return {
      totals,
      lastTripScore,
      lastTripDifference: difference(lastTripScore, recentAverage),
      recentAverage,
      changeSinceStart: difference(recentAverage, firstAverage),
      longTermScore,
      risk: longTermScore === null ? null : riskForScore(longTermScore),
      bestTripScore,
    };
  }

  scoreHistory(driverId: Types.ObjectId): Promise<ScorePointDto[]> {
    return this.tripsService.scoreHistory(driverId);
  }

  /** Count and points lost per incident type, every type listed; over the last `days` days, or all time. */
  incidentSummary(driverId: Types.ObjectId, days?: number): Promise<IncidentTypeSummaryDto[]> {
    return this.incidentsService.summarizeByType(driverId, days === undefined ? undefined : new Date(Date.now() - days * DAY_MS));
  }

  async incidents(driverId: Types.ObjectId, { days, sort, limit }: DriverIncidentsQueryDto): Promise<DriverIncidentDto[]> {
    const incidents = await this.incidentsService.findByDriver(driverId, days, { sort: INCIDENT_SORTS[sort], limit });
    return incidents.map(({ _id, trip, type, severity, occurredAt, pointsDeducted }) => ({
      id: _id.toString(),
      tripId: trip.toString(),
      type,
      severity,
      occurredAt: occurredAt.toISOString(),
      pointsDeducted,
    }));
  }
}
