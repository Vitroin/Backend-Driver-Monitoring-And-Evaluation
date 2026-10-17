import type { DataResponseDto } from '@common';
import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { IncidentsRepository, type TripIncidentFilter, type TripIncidentRow } from './incidents.repository';
import type { SignificantEventDto } from './response/significant-event.response';

// "Most significant events": the 5 incidents that cost the most points in the last 60 days
const SIGNIFICANT_EVENTS_DAYS = 60;
const SIGNIFICANT_EVENTS_LIMIT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class IncidentsService {
  constructor(private readonly incidentsRepository: IncidentsRepository) {}

  // Used in the Main Dashboard: the 5 incidents that cost the most points in the last 60 days
  async getIncidents(driverId: string): Promise<DataResponseDto<SignificantEventDto[]>> {
    const since = new Date(Date.now() - SIGNIFICANT_EVENTS_DAYS * DAY_MS);
    const incidents = await this.incidentsRepository.findMostSignificant(driverId, since, SIGNIFICANT_EVENTS_LIMIT);
    return {
      message: 'Most significant events',
      data: incidents.map(({ _id, type, severity, occurredAt, pointsDeducted }) => ({
        id: _id.toString(),
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


  // ---------- used by other modules ----------

  // One trip's incidents, oldest first (the trip map's markers and timeline)
  findByTrip(tripId: Types.ObjectId, filter?: TripIncidentFilter): Promise<TripIncidentRow[]> {
    return this.incidentsRepository.findByTrip(tripId, filter);
  }
}
