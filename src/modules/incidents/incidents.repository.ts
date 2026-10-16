import { IncidentType } from '@common/enums';
import { BaseRepository } from '@common/repositories';
import { Injectable } from '@nestjs/common';
import { Incident } from './incidents.model';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

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


}
