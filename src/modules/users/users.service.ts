import { Injectable, NotFoundException } from '@nestjs/common';
import { Types, type QueryFilter } from 'mongoose';
import type { Page } from '@common';
import { UserRole, UserStatus } from '@common/enums';
import { UsersRepository } from './users.repository';
import { UsersFactory } from './users.factory';
import { CreateUserDto } from './create-user.dto';
import type { User, UserDocument } from './user.model';
import type { ListUsersQueryDto } from './list-users.dto';
import type { UserOrganizationDto } from './response/user.response';

// The fields the user list shows; never the password hash or the security stamp
const LIST_FIELDS = 'username fullName email role status organization createdAt';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly usersFactory: UsersFactory,
  ) {}

  listUsers({ role, organizationId, page, limit }: ListUsersQueryDto): Promise<Page<UserDocument>> {
    const filter: QueryFilter<User> = {};
    if (role) filter.role = role;
    if (organizationId) filter.organization = organizationId;
    return this.usersRepository.findPage(filter, { page, limit }, { projection: LIST_FIELDS, sort: { createdAt: -1 } });
  }

  async updateFullName(id: string, fullName: string): Promise<{ fullName: string }> {
    const user = await this.usersRepository.updateById(id, { fullName });
    if (!user) throw new NotFoundException('User not found');
    return { fullName: user.fullName };
  }

  /** Records a deletion request. Repeating it keeps the first request's date. @returns false if one was already recorded. */
  async requestDeletion(id: string): Promise<boolean> {
    const user = await this.usersRepository.updateOne({ _id: id, deletionRequestedAt: null }, { deletionRequestedAt: new Date() });
    return user !== null;
  }

  /** The organization the user belongs to; null for super admins. */
  async findOrganizationOf(id: string): Promise<UserOrganizationDto> {
    const user = await this.usersRepository.findWithOrganization(id);
    if (!user) throw new NotFoundException('User not found');
    const { organization } = user;
    return organization ? { id: organization.id, name: organization.name, organizationType: organization.organizationType } : null;
  }

  /** Sets a new password, clears mustChangePassword and rotates the stamp (old tokens stop working). @returns The new stamp. */
  async changePassword(id: string, passwordHash: string): Promise<string> {
    const securityStamp = new Types.ObjectId();
    await this.usersRepository.updateById(id, { passwordHash, securityStamp, mustChangePassword: false });
    return securityStamp.toString();
  }

  /** Activates an invited user with the password they chose. */
  async activate(id: string, passwordHash: string): Promise<void> {
    const user = await this.usersRepository.updateOne(
      { _id: id, status: UserStatus.WAITING_FOR_ACTIVATION },
      { passwordHash, status: UserStatus.ACTIVE, mustChangePassword: false, securityStamp: new Types.ObjectId() },
    );
    if (!user) throw new NotFoundException('No pending invitation for this user');
  }

  async rotateSecurityStamp(id: string): Promise<string> {
    const securityStamp = new Types.ObjectId();
    const user = await this.usersRepository.updateById(id, { securityStamp });
    if (!user) throw new NotFoundException('User not found');
    return securityStamp.toString();
  }

  /** `withPasswordHash` also loads the hash, which is `select: false`, for checking a password at login. */
  findByUsername(username: string, { withPasswordHash = false } = {}) {
    return this.usersRepository.findOne({ username }, withPasswordHash ? '+passwordHash' : undefined);
  }

  /** For checking the current password when changing it. */
  findWithCredentialsById(id: string) {
    return this.usersRepository.findById(id, '+passwordHash');
  }

  findDriverInOrganization(driverId: string, organizationId: string) {
    return this.usersRepository.findOne({ _id: driverId, organization: organizationId, role: UserRole.DRIVER });
  }



  async createUser(dto: CreateUserDto, hashedPassword: string) {
    const user = this.usersFactory.createUser(dto, hashedPassword);
    // The random part makes a clash unlikely; if one happens, generate another
    while (await this.usersRepository.exists({ username: user.username })) {
      user.username = this.usersFactory.generateUsername(dto.email);
    }
    return this.usersRepository.create(user);
  }

  findById(id: string) {
    return this.usersRepository.findById(id);
  }

  /** Used by the guard and refresh: same as findById, kept separate so you can add a projection or cache later. */
  findForAuthentication(id: string) {
    return this.usersRepository.findById(id);
  }
}
