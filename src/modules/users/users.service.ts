import { Injectable } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { CreateUserDto } from '@modules/auth/dtos/create-user.dto';
import { UsersFactory } from './users.factory';
import { Types } from 'mongoose';

@Injectable()
export class UsersService {
  constructor(
    readonly usersRepository: UsersRepository,
    readonly usersFactory: UsersFactory,
  ) {}

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
}
