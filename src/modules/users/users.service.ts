import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { UsersFactory } from './users.factory';
import { Types } from 'mongoose';
import { CreateUserDto } from './create-user.dto';
import { UserRole, UserStatus } from '@common/enums';
import type { DataResponseDto, MessageResponseDto } from '@common';
import type { FullNameResponseDto } from './response/full-name.response';

@Injectable()
export class UsersService {
  constructor(
    readonly usersRepository: UsersRepository,
    readonly usersFactory: UsersFactory,
  ) {}

  //ToDo Pagination
  async findAllUsers(role?: UserRole) {
    const filter = role ? { role } : {};

    const users = await this.usersRepository.find(filter, {
      fullName: 1,
      email: 1,
      username: 1,
      status: 1,
      organization: 1,
      role: 1,
      createdAt: 1,
    });

    return {
      success: true,
      message: 'Users retrieved successfully',
      data: users,
    };
  }

  async updateFullName(id: string, fullName: string): Promise<DataResponseDto<FullNameResponseDto>> {
    const user = await this.usersRepository.updateById(id, { fullName });
    if (!user) throw new NotFoundException('User not found');
    return { message: 'Full name updated successfully', data: { fullName: user.fullName } };
  }

  /** Records a deletion request. Repeating it keeps the first request's date. */
  async requestDeletion(id: string | Types.ObjectId): Promise<MessageResponseDto> {
    const user = await this.usersRepository.updateOne(
      { _id: new Types.ObjectId(id), deletionRequestedAt: null },
      { deletionRequestedAt: new Date() },
    );
    return { message: user ? 'Your deletion request was recorded' : 'Your deletion request was already recorded' };
  }

  /** Returns Enrolled Organizations */
  async showEnrolledOrganizations(id: string) {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user.organization;
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

  async findByUsername(username: string) {
    const user = await this.usersRepository.findOne({ username });
    return user;
  }

  async findByEmail(email: string) {
    const user = await this.usersRepository.findOne({ email });
    return user;
  }

  async findByEmailInOrganization(email: string, organizationId: string) {
    return this.usersRepository.findOne({
      email: email.toLowerCase(),
      organization: new Types.ObjectId(organizationId),
    });
  }

  async createUser(dto: CreateUserDto, hashedPassword: string) {
    const user = this.usersFactory.createUser(dto, hashedPassword);
    return this.usersRepository.create(user);
  }

  async findWithCredentialsById(id: string) {
    return this.usersRepository.findOne({ _id: new Types.ObjectId(id) });
  }

  findById(id: string) {
    return this.usersRepository.findById(id);
  }

  /** Used by the guard and refresh: same as findById, kept separate so you can add a projection or cache later. */
  findForAuthentication(id: string) {
    return this.usersRepository.findById(id);
  }
}
