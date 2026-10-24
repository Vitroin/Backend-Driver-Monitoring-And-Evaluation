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

  // The organization with its drivers and employees, with only the user fields that are safe to show
  findByIdWithMembers(id: string) {
    const memberFields = 'username fullName email role status';
    return this.organizationModel
      .findById(id)
      .populate([
        { path: 'organizationDrivers', select: memberFields },
        { path: 'organizationEmployees', select: memberFields },
      ])
      .exec();
  }
}
