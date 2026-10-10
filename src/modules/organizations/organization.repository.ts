import { BaseRepository } from '@common/repositories';
import { Injectable } from '@nestjs/common';
import { Organization } from './organization.model';
import { InjectModel} from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class OrganizationsRepository extends BaseRepository<Organization> {
  constructor(@InjectModel(Organization.name) private readonly organizationModel: Model<Organization>) {
      super(organizationModel);
  }
}
