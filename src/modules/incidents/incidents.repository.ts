import { IncidentSeverity, IncidentType } from '@common/enums';
import { BaseRepository } from '@common/repositories';
import { Injectable } from '@nestjs/common';
import { Incident } from './incidents.model';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, SortOrder, Types } from 'mongoose';

export type TripIncidentFilter = { eventType?: IncidentType; severity?: IncidentSeverity };
export type TripIncidentOptions = { sort?: Record<string, SortOrder>; limit?: number };
export type TripIncidentRow = Pick<
  Incident,
  'type' | 'severity' | 'occurredAt' | 'location' | 'speedKmh' | 'clipUrl' | 'pointsDeducted'
> & { _id: Types.ObjectId };

@Injectable()
export class IncidentsRepository extends BaseRepository<Incident> {
  constructor(@InjectModel(Incident.name) private readonly incidentModel: Model<Incident>) {
    super(incidentModel);
  }

  // The 5 incidents that cost the most points in the last 60 days
  async findMostSignificant(driverId: string | Types.ObjectId, since: Date, limit: number) {
    return this.incidentModel
      .find({ driver: driverId, occurredAt: { $gte: since } })
      .sort({ pointsDeducted: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  // A trip's incidents, optionally only one type and/or severity.
  // Chronological unless `sort` says otherwise (uses the { trip, occurredAt } index); `limit` 0 means no limit.
  findByTrip(
    tripId: string | Types.ObjectId,
    { eventType, severity }: TripIncidentFilter = {},
    { sort = { occurredAt: 1 }, limit = 0 }: TripIncidentOptions = {},
  ) {
    const filter: QueryFilter<Incident> = { trip: tripId };
    if (eventType) filter.type = eventType;
    if (severity) filter.severity = severity;

    return this.incidentModel
      .find(filter)
      .select('type severity occurredAt location speedKmh clipUrl pointsDeducted')
      .sort(sort)
      .limit(limit)
      .lean<TripIncidentRow[]>()
      .exec();
  }
}
