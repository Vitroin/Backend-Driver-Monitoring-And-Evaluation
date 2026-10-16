import type { DataResponseDto } from '@common';
import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { IncidentDocument } from './incidents.model';
import { IncidentsRepository, type TripIncidentFilter, type TripIncidentRow } from './incidents.repository';
import type { SignificantEventDto } from './response/significant-event.response';

// "Most significant events": the 5 incidents that cost the most points in the last 60 days
const SIGNIFICANT_EVENTS_DAYS = 60;
const SIGNIFICANT_EVENTS_LIMIT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class IncidentsService {
  constructor(private readonly incidentsRepository: IncidentsRepository) {}

  async getMostSignificant(driverId: string): Promise<DataResponseDto<SignificantEventDto[]>> {
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

  // ---------- used by other modules ----------

  // The incidents of these trips (the post-trip report)
  findByTrips(tripIds: Types.ObjectId[]): Promise<IncidentDocument[]> {
    return this.incidentsRepository.find({ trip: { $in: tripIds } });
  }

  // Every incident of the driver, newest first ("Download my data")
  findAllByDriver(driverId: Types.ObjectId): Promise<IncidentDocument[]> {
    return this.incidentsRepository.find({ driver: driverId }, undefined, { sort: { occurredAt: -1 } });
  }

  // One trip's incidents, oldest first (the trip map's markers and timeline)
  findByTrip(tripId: Types.ObjectId, filter?: TripIncidentFilter): Promise<TripIncidentRow[]> {
    return this.incidentsRepository.findByTrip(tripId, filter);
  }
  
}