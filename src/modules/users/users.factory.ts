import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { User } from './user.model';
import { CreateUserDto } from '@modules/auth/dtos/create-user.dto';

@Injectable()
export class UsersFactory {
  createUser(dto: CreateUserDto, hashedPassword: string): User {
    const user = new User();
    user.username = dto.username;
    user.email = dto.email;
    user.password = hashedPassword;
    user.age = dto.age;
    user.gender = dto.gender;
    user.role = dto.role;
    if (dto.organization) user.organization = new Types.ObjectId(dto.organization);
    return user;
  }
}