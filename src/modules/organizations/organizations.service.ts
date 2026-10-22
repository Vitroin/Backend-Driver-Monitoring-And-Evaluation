import { ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { mongo, Types } from 'mongoose';
import { AuthService } from '@modules/auth/auth.service';
import { UsersService } from '@modules/users/users.service';
import { TransactionService } from '@shared/modules/transactions/transactions.service';
import { CreateOrganizationDto } from './dtos/create-organization.dto';
import { OrganizationsRepository } from './organization.repository';
import { OrganizationsFactory } from './organization.factory';
import { OWNER_ROLES } from './organizations.enum';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly organizationsRepository: OrganizationsRepository,
    private readonly organizationsFactory: OrganizationsFactory,
    private readonly usersService: UsersService,
    private readonly transactions: TransactionService,
    private readonly authService: AuthService,

  ) {}


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

  /** Creates the organization, then its owner as a new invited user (emailed a link to set their password). All or nothing. */
  async createOrganization(createOrganizationDto: CreateOrganizationDto) {
    const { fullName, email, age, gender, organizationType } = createOrganizationDto;
    try {
      const createdOrganization = await this.transactions.run(async () => {
        const organization = await this.organizationsRepository.create(this.organizationsFactory.createOrganization(createOrganizationDto));
        await this.authService.inviteUser({
          fullName,
          email,
          age,
          gender,
          role: OWNER_ROLES[organizationType],
          organization: organization.id,
        });
        // inviteUser only returns a message, so the new owner is found by email in the new organization
        const owner = await this.usersService.findByEmailInOrganization(email, organization.id);
        if (!owner) throw new InternalServerErrorException('Organization owner was not created');
        organization.organizationOwner = owner._id;
        return organization.save();
      });
      return {
        success: true,
        data: createdOrganization,
      };
    } catch (error) {
      if (!(error instanceof mongo.MongoServerError) || error.code !== 11000) throw error;
      throw new ConflictException('Organization already exists');
    }
  }
}
