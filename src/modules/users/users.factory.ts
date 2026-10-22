import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { Types } from 'mongoose';
import { User } from './user.model';
import { CreateUserDto } from './create-user.dto';

@Injectable()
export class UsersFactory {
  createUser(dto: CreateUserDto, hashedPassword: string): User {
    const user = new User();
    user.username = this.generateUsername(dto.email);
    user.fullName = dto.fullName;
    user.email = dto.email;
    user.passwordHash = hashedPassword;
    user.age = dto.age;
    user.gender = dto.gender;
    user.role = dto.role;
    if (dto.organization) user.organization = [new Types.ObjectId(dto.organization)];
    return user;
  }

  /** "jane.doe@mail.com" -> "jane-doe-k3x9q". Each call gives a new random part, so call again if the username is taken. */
  generateUsername(email: string): string {
    // Capped at 24 so the "-" and 5 random characters stay within the login form's 30
    const slug = email
      .split('@')[0]
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .slice(0, 24)
      .replace(/^-+|-+$/g, '');
    // 5 random lowercase letters/digits (about 60 million combinations per slug)
    const suffix = crypto.randomInt(36 ** 5).toString(36).padStart(5, '0');
    return slug ? `${slug}-${suffix}` : suffix;
  }
}
