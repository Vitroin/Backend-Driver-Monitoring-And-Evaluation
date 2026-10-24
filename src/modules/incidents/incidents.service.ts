import type { DataResponseDto } from '@common';
import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { IncidentsRepository, type TripIncidentFilter, type TripIncidentOptions, type TripIncidentRow } from './incidents.repository';
import type { Incident } from './incidents.model';
import type { DriverIncidentDto } from './response/significant-event.response';
import type { IncidentTypeSummaryDto } from './response/trip-incidents.response';
import { CacheService } from '@infrastructure/cache';
import { IncidentType } from '@common/enums';

// "Most significant events": the 5 incidents that cost the most points in the last 60 days
const SIGNIFICANT_EVENTS_DAYS = 60;
const SIGNIFICANT_EVENTS_LIMIT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

const WINDOW_DAYS = 21;
const TYPE_COUNTS_KEY = 'incidents:type-counts:21d';

@Injectable()
export class IncidentsService {
  constructor(
    private readonly incidentsRepository: IncidentsRepository,
    private readonly cacheService: CacheService,
  ) {}

  // Used in the Main Dashboard: the 5 incidents that cost the most points in the last 60 days
  async getIncidents(driverId: string): Promise<DataResponseDto<DriverIncidentDto[]>> {
    const since = new Date(Date.now() - SIGNIFICANT_EVENTS_DAYS * DAY_MS);
    const incidents = await this.incidentsRepository.findMostSignificant(driverId, since, SIGNIFICANT_EVENTS_LIMIT);
    return {
      message: 'Most significant events',
      data: incidents.map(({ _id, trip, type, severity, occurredAt, pointsDeducted }) => ({
        id: _id.toString(),
        tripId: trip.toString(),
        type,
        severity,
        occurredAt: occurredAt.toISOString(),
        pointsDeducted,
      })),
    };
  }

  // Used in the Trip Report Dashboard: a trip's incidents, most points deducted first
  async getTopIncidentsForTrip(tripId: Types.ObjectId, limit: number) {
    const incidents = await this.incidentsRepository.findByTrip(tripId, {}, { sort: { pointsDeducted: -1 }, limit });
    return {
      message: 'Top incidents for trip',
      data: { incidents },
    };
  }
  //--------------------------------------------------
  //---------- used by the Progress Dashboard's ----------------

  //gets all points lost for driver regarding his overall history, inorder to generate component ' Where points are lost '
  async getAllIncidentsForTrip(driverId: string | Types.ObjectId) {
    const incidents = await this.incidentsRepository.sumDeductionsByType(driverId);
    return {
      message: 'All incidents for trip',
      data: { incidents },
    };
  }

  //gets the all event counts for driver regarding his overall history, inorder to generate chart
  async getEventMix(driverId: string | Types.ObjectId) {
    const incidents = await this.incidentsRepository.countIncidentsByType(driverId);
    return {
      message: 'All Event Mix',
      data: { incidents },
    };
  }

  //--------------------------------------------------

  // ---------- used by other modules ----------

  // One trip's incidents, oldest first unless `options.sort` says otherwise (the trip map's markers and timeline)
  findByTrip(tripId: Types.ObjectId, filter?: TripIncidentFilter, options?: TripIncidentOptions): Promise<TripIncidentRow[]> {
    return this.incidentsRepository.findByTrip(tripId, filter, options);
  }

  /** A driver's incidents in the last `days` days. */
  findByDriver(driverId: Types.ObjectId, days: number, options?: TripIncidentOptions) {
    return this.incidentsRepository.findByDriver(driverId, new Date(Date.now() - days * DAY_MS), options);
  }

  /** A driver's count and points lost for every incident type (0 for types that didn't happen), in IncidentType order. */
  async summarizeByType(driverId: Types.ObjectId, since?: Date): Promise<IncidentTypeSummaryDto[]> {
    const rows = await this.incidentsRepository.summarizeByType(driverId, since);
    const byType = new Map(rows.map((row) => [row.type, row]));
    return Object.values(IncidentType).map((type) => byType.get(type) ?? { type, count: 0, totalDeduction: 0 });
  }

  tripTotals(tripId: Types.ObjectId): Promise<{ count: number; pointsDeducted: number }> {
    return this.incidentsRepository.tripTotals(tripId);
  }


  async getRecentTypeCounts() {
    const cached = await this.cacheService.get<{ _id: IncidentType; count: number }[]>(TYPE_COUNTS_KEY);
    if (cached) return cached;

    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const counts = await this.incidentsRepository.countByTypeSince(since);
    await this.cacheService.set({ key: TYPE_COUNTS_KEY, value: counts, ttl: 10 * 60 });
    return counts;
  }
}
