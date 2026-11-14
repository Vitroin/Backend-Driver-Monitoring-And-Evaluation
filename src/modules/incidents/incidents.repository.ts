import { BaseRepository } from '@common/repositories';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { Incident } from './incidents.model';
import type { IncidentOverview, IncidentOverviewFilter, IncidentRow, TripIncidentFilter } from './incidents.types';

@Injectable()
export class IncidentsRepository extends BaseRepository<Incident> {
  constructor(@InjectModel(Incident.name) private readonly incidentModel: Model<Incident>) {
    super(incidentModel);
  }

  // One query for both the list (top `limit` by points) and the counts (all matching incidents).
  // Always filtered by driver, so the { driver, occurredAt } index is used.
  async findOverview({ driver, trip, since, severities }: IncidentOverviewFilter, limit: number) {
    const [result] = await this.incidentModel
      .aggregate<IncidentOverview>([
        {
          // aggregate() doesn't auto-cast strings to ObjectId like find() does
          $match: {
            driver: new Types.ObjectId(driver),
            ...(trip ? { trip: new Types.ObjectId(trip) } : {}),
            ...(since ? { occurredAt: { $gte: since } } : {}),
            ...(severities?.length ? { severity: { $in: severities } } : {}),
          },
        },
        {
          $facet: {
            incidents: [
              { $sort: { pointsDeducted: -1, occurredAt: -1 } },
              { $limit: limit },
              {
                $project: {
                  trip: 1,
                  type: 1,
                  severity: 1,
                  occurredAt: 1,
                  location: 1,
                  speedKmh: 1,
                  clipUrl: 1,
                  pointsDeducted: 1,
                },
              },
            ],
            byType: [
              { $group: { _id: '$type', count: { $sum: 1 }, pointsLost: { $sum: '$pointsDeducted' } } },
              { $project: { _id: 0, type: '$_id', count: 1, pointsLost: 1 } },
              { $sort: { pointsLost: -1 } },
            ],
            total: [{ $count: 'value' }],
          },
        },
        // $count returns [] when nothing matched, so turn it into 0
        { $project: { incidents: 1, byType: 1, total: { $ifNull: [{ $first: '$total.value' }, 0] } } },
      ])
      .exec();

    return result; // $facet always returns exactly one document, even when nothing matched
  }

  // A trip's incidents, oldest first, optionally only one type and/or severity (used by the trip map)
  findByTrip(tripId: string | Types.ObjectId, { eventType, severity, driver }: TripIncidentFilter = {}) {
    const filter: QueryFilter<Incident> = { trip: tripId };
    if (eventType) filter.type = eventType;
    if (severity) filter.severity = severity;
    if (driver) filter.driver = driver;

    return this.incidentModel
      .find(filter)
      .select('trip type severity occurredAt location speedKmh clipUrl pointsDeducted')
      .sort({ occurredAt: 1 })
      .lean<IncidentRow[]>()
      .exec();
  }
}
