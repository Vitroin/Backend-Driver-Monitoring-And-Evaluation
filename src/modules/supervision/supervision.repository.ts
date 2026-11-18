import { BaseRepository } from '@common/repositories';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Supervision } from './supervision.model';
import { Model, Types } from 'mongoose';

@Injectable()
export class SupervisionRepository extends BaseRepository<Supervision> {
  constructor(@InjectModel('Supervision') private readonly supervisionModel: Model<Supervision>) {
    super(supervisionModel);
  }

  async findDriverIds(supervisorId: Types.ObjectId, organizationId: Types.ObjectId): Promise<Types.ObjectId[]> {
    const rows = await this.model
      .find({ supervisorId, organizationId })
      .select('driver _id')
      .lean<{ driver: Types.ObjectId }[]>()
      .exec();
    return rows.map((row) => row.driver);
  }
}
