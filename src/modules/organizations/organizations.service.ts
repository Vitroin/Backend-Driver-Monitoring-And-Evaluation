import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { mongo } from 'mongoose';
import type { Page, PaginationQuery } from '@common';
import { UserRole } from '@common/enums';
import { AuthService } from '@modules/auth/auth.service';
import { UsersService } from '@modules/users/users.service';
import type { UserDocument } from '@modules/users/user.model';
import { TransactionService } from '@shared/modules/transactions/transactions.service';
import { CreateOrganizationDto } from './dtos/create-organization.dto';
import { InviteMemberDto } from './dtos/invite-employee.dto';
import { OrganizationsRepository } from './organization.repository';
import { OrganizationsFactory } from './organization.factory';
import type { OrganizationDocument } from './organization.model';
import { EMPLOYEE_ROLES, OWNER_ROLES } from './organizations.enum';
import type { OrganizationMemberDto } from './response/organization.response';

/** Who is being invited: an employee gets the organization type's employee role, a driver the driver role. */
export type MemberKind = 'employee' | 'driver';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly organizationsRepository: OrganizationsRepository,
    private readonly organizationsFactory: OrganizationsFactory,
    private readonly usersService: UsersService,
    private readonly transactions: TransactionService,
    private readonly authService: AuthService,
  ) {}

  listOrganizations(pagination: PaginationQuery): Promise<Page<OrganizationDocument>> {
    return this.organizationsRepository.findPage({}, pagination, {
      projection: { name: 1, organizationType: 1, organizationOwner: 1, createdAt: 1 },
      sort: { name: 1 },
    });
  }

  /** One organization with its drivers and employees. */
  async findOrganizationWithMembers(organizationId: string): Promise<OrganizationDocument> {
    const organization = await this.organizationsRepository.findByIdWithMembers(organizationId);
    if (!organization) throw new NotFoundException('Organization not found');
    return organization;
  }

  /**
   * Creates the organization and its owner as a new invited user, all or nothing, then emails the owner a link to set
   * their password. The email goes out only after the transaction commits, so a rolled back owner is never emailed.
   */
  async createOrganization(createOrganizationDto: CreateOrganizationDto): Promise<OrganizationDocument> {
    const { fullName, email, age, gender, organizationType } = createOrganizationDto;
    try {
      const { organization, owner } = await this.transactions.run(async () => {
        const organization = await this.organizationsRepository.create(this.organizationsFactory.createOrganization(createOrganizationDto));
        const owner = await this.authService.createInvitedUser({
          fullName,
          email,
          age,
          gender,
          role: OWNER_ROLES[organizationType],
          organization: organization.id,
        });
        organization.organizationOwner = owner._id;
        await organization.save();
        return { organization, owner };
      });
      await this.authService.sendInvitation(owner);
      return organization;
    } catch (error) {
      if (!(error instanceof mongo.MongoServerError) || error.code !== 11000) throw error;
      throw new ConflictException('Organization already exists');
    }
  }

  /** Invites an employee or a driver into the organization; they are emailed a link to set their password. */
  async inviteMember(organizationId: string, dto: InviteMemberDto, kind: MemberKind): Promise<OrganizationMemberDto> {
    const organization = await this.organizationsRepository.findById(organizationId);
    if (!organization) throw new NotFoundException('Organization not found');

    const role = kind === 'driver' ? UserRole.DRIVER : EMPLOYEE_ROLES[organization.organizationType];
    const user = await this.authService.createInvitedUser({ ...dto, role, organization: organizationId });
    await this.authService.sendInvitation(user);
    return this.toMember(user);
  }

  // Will be used by Super_Admin to assign an owner to an organization. This is useful when the organization is created without an owner and the SuperAdmin wants to assign one later.
  async assignOrganizationOwner(organizationId: string, ownerId: string): Promise<void> {
    const organization = await this.organizationsRepository.findById(organizationId);
    if (!organization) throw new NotFoundException('Organization not found');
    const owner = await this.usersService.findById(ownerId);
    if (!owner) throw new NotFoundException('Owner not found');
    organization.organizationOwner = owner._id;
    await organization.save();
  }

  // Mapped field by field: a freshly created user still holds its password hash in memory
  private toMember(user: UserDocument): OrganizationMemberDto {
    const { id, username, fullName, email, role, status } = user;
    return { id, username, fullName, email, role, status };
  }
}
