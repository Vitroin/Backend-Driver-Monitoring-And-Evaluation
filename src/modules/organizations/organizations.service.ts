import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { CreateOrganizationDto } from './dtos/create-organization.dto';
import { OrganizationsRepository } from './organization.repository';

@Injectable()
export class OrganizationsService {
  constructor(private readonly organizationsRepository: OrganizationsRepository) {}


  // Every organization except the given one, by name (the privacy page's "share with" dropdown)
  findAllExcept(organizationId: Types.ObjectId) {
    return this.organizationsRepository.find(
      { _id: { $ne: organizationId } },
      { name: 1, organizationType: 1 },
      { sort: { name: 1 } },
    );
  }

  exists(id: Types.ObjectId): Promise<boolean> {
    return this.organizationsRepository.exists({ _id: id });
  }

  async findAllOrganizations() {
    const organizations = await this.organizationsRepository.find(
      {},
      {
        name: 1,
        organizationType: 1,
        organizationOwner: 1,
        createdAt: 1,
      },
      {
        sort: { name: 1 },
      },
    );

    return {
      success: true,
      data: organizations,
    };
  }

  createOrganization(createOrganizationDto: CreateOrganizationDto) {
    
  }
}
