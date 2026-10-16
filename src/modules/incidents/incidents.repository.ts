import { IncidentSeverity, IncidentType } from '@common/enums';
import { BaseRepository } from '@common/repositories';
import { Injectable } from '@nestjs/common';
import { Incident } from './incidents.model';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';

export type TripIncidentFilter = { eventType?: IncidentType; severity?: IncidentSeverity };
export type TripIncidentRow = Pick<
  Incident,
  'type' | 'severity' | 'occurredAt' | 'location' | 'speedKmh' | 'clipUrl' | 'pointsDeducted'
> & { _id: Types.ObjectId };

@Injectable()
export class IncidentsRepository extends BaseRepository<Incident> {
  constructor(@InjectModel(Incident.name) private readonly incidentModel: Model<Incident>) {
    super(incidentModel);
  }

  async findMostSignificant(driverId: string | Types.ObjectId, since: Date, limit: number) {
    return this.incidentModel
      .find({ driver: driverId, occurredAt: { $gte: since } })
      .sort({ pointsDeducted: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  // A trip's incidents in chronological order, optionally only one type and/or severity (uses the { trip, occurredAt } index)
  findByTrip(tripId: string | Types.ObjectId, { eventType, severity }: TripIncidentFilter = {}) {
    const filter: QueryFilter<Incident> = { trip: tripId };
    if (eventType) filter.type = eventType;
    if (severity) filter.severity = severity;

    return this.incidentModel
      .find(filter)
      .select('type severity occurredAt location speedKmh clipUrl pointsDeducted')
      .sort({ occurredAt: 1 })
      .lean<TripIncidentRow[]>()
      .exec();
  }
}
