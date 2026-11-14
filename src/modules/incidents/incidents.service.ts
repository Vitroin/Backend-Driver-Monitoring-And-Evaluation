import type { DataResponseDto } from '@common';
import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { IncidentsRepository } from './incidents.repository';
import type { IncidentRow, TripIncidentFilter } from './incidents.types';
import type { IncidentsOverviewDto } from './response/incidents-overall.response';
import type { MyIncidentsQueryDto } from './dtos/my-incidents.query';

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

@Injectable()
export class IncidentsService {
  constructor(private readonly incidentsRepository: IncidentsRepository) {}

  // Main Dashboard, Trip Report, car widget and major events all use this, each with different filters
  async getMyIncidents(
    driverId: string,
    { tripId, sinceDays, severity, limit }: MyIncidentsQueryDto,
  ): Promise<DataResponseDto<IncidentsOverviewDto>> {
    const { incidents, total, byType } = await this.incidentsRepository.findOverview(
      {
        driver: driverId,
        trip: tripId,
        since: sinceDays ? daysAgo(sinceDays) : undefined,
        severities: severity,
      },
      limit,
    );

    return {
      message: 'Incidents',
      data: {
        incidents: incidents.map((i) => ({
          id: i._id.toString(),
          tripId: i.trip.toString(),
          type: i.type,
          severity: i.severity,
          occurredAt: i.occurredAt.toISOString(),
          location: i.location,
          speedKmh: i.speedKmh,
          clipUrl: i.clipUrl,
          pointsDeducted: i.pointsDeducted,
        })),
        total,
        byType,
      },
    };
  }

  // ---------- used by other modules ----------

  // One trip's incidents, oldest first (the trip map's markers and timeline)
  findByTrip(tripId: Types.ObjectId, filter?: TripIncidentFilter): Promise<IncidentRow[]> {
    return this.incidentsRepository.findByTrip(tripId, filter);
  }
}
