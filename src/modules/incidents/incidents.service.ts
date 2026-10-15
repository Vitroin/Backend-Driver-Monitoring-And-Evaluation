import { Injectable } from '@nestjs/common';
import { IncidentsRepository } from './incidents.repository';
import { SignificantEventDto } from './response/significant-event.response';
import { DataResponseDto } from '@common';

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
      data: incidents.map((incident) => ({
        id: incident._id.toString(),
        type: incident.type,
        severity: incident.severity,
        occurredAt: incident.occurredAt.toISOString(),
        pointsDeducted: incident.pointsDeducted,
      })),
    };
  }
}
