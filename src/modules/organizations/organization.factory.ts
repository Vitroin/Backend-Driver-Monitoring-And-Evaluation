import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { Organization } from './organization.model';
import { CreateOrganizationDto } from './dtos/create-organization.dto';

@Injectable()
export class OrganizationsFactory {
  createOrganization(dto: CreateOrganizationDto): Organization {
    const organization = new Organization();
    organization.name = dto.name;
    organization.organizationType = dto.organizationType;
    organization.organizationOwner = dto.organizationOwner ? new Types.ObjectId(dto.organizationOwner) : null;
    return organization;
  }

}
