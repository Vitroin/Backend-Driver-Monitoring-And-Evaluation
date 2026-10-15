import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { User } from './user.model';
import { CreateUserDto } from './create-user.dto';

@Injectable()
export class UsersFactory {
  createUser(dto: CreateUserDto, hashedPassword: string): User {
    const user = new User();
    user.username = dto.username;
    user.fullName = dto.fullName;
    user.email = dto.email;
    user.passwordHash = hashedPassword;
    user.age = dto.age;
    user.gender = dto.gender;
    user.role = dto.role;
    if (dto.organization) user.organization = new Types.ObjectId(dto.organization);
    return user;
  }
}
