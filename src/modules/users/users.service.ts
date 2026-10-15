import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { UsersFactory } from './users.factory';
import { Types } from 'mongoose';
import { CreateUserDto } from './create-user.dto';
import { randomUUID } from 'node:crypto';
import { UserStatus } from '@common/enums';

@Injectable()
export class UsersService {
  constructor(
    readonly usersRepository: UsersRepository,
    readonly usersFactory: UsersFactory,
  ) {}

  
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

  /** Records a deletion request. @returns false if one was already recorded (the first request's date is kept). */
  async requestDeletion(id: string | Types.ObjectId): Promise<boolean>{
    const user = await this.usersRepository.updateOne(
      {_id: new Types.ObjectId(id), deletionRequestedAt: null},
      {deletionRequestedAt: new Date()},
    )
    return user !== null;
  }


}
