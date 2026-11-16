import { OrganizationsService } from '@modules/organizations/organizations.service';
import { UsersService } from '@modules/users/users.service';
import { SupervisionRepository } from './supervision.repository';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { mongo } from 'mongoose';
import { EMPLOYEE_ROLES } from '@modules/organizations/organizations.enum';
import { MessageResponseDto } from '@common';

@Injectable()
export class SupervisionService {
  constructor(
    private readonly supervisionsRepository: SupervisionRepository,
    private readonly usersService: UsersService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async assign(organizationId: string, supervisorId: string, driverId: string): Promise<MessageResponseDto> {
    const organization = await this.organizationsService.findById(organizationId);
    if (!organization) throw new NotFoundException('Organization not found');

    const driver = await this.usersService.findDriverInOrganization(driverId, organizationId);
    if (!driver) throw new NotFoundException('Driver not found in this organization');

    // only the employee role of this organization type can supervise (instructor / fleet analyst / insurance analyst)
    const supervisor = await this.usersService.findOne(
      supervisorId,
      organizationId,
      EMPLOYEE_ROLES[organization.organizationType],
    );
    if (!supervisor) throw new NotFoundException('Supervisor not found in this organization');

    try {
      await this.supervisionsRepository.create({
        organization: organization._id,
        supervisor: supervisor._id,
        driver: driver._id,
      });
    } catch (error) {
      if (error instanceof mongo.MongoServerError && error.code === 11000) {
        throw new ConflictException('Driver is already assigned to this supervisor');
      }
      throw error;
    }
    return { message: 'Driver assigned successfully' };
  }
}
